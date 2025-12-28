sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/library",
    "artistmanagement/model/formatter",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Controller, fLibrary, formatter, Fragment, JSONModel, MessageToast, Filter, FilterOperator) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;

    return Controller.extend("artistmanagement.controller.ArtistDetail", {
        formatter,

        onExit() {
            if (this._reviewDialogPromise) {
                this._reviewDialogPromise.then((dialog) => dialog.destroy());
            }
            if (this._performanceDialogPromise) {
                this._performanceDialogPromise.then((dialog) => dialog.destroy());
            }
        },

        onCloseDetail() {
            let parent = this.getView().getParent();
            while (parent && !parent.isA("sap.f.FlexibleColumnLayout")) {
                parent = parent.getParent();
            }
            if (parent && parent.setLayout) {
                parent.setLayout(LayoutType.OneColumn);
            }
        },

        formatSpotifyHref(value) {
            if (!value) {
                return "";
            }
            return value;
        },

        formatInstagramHref(handle) {
            if (!handle) {
                return "";
            }
            const sanitized = handle.replace(/^@/, "");
            return `https://instagram.com/${sanitized}`;
        },

        formatGenre(value) {
            return formatter.formatGenre(value);
        },

        formatDate(value) {
            return formatter.formatDate(value);
        },

        formatDateTime(value) {
            return formatter.formatDateTime(value);
        },

        formatPerformanceSlot(startAt, endAt) {
            return formatter.formatPerformanceSlot(startAt, endAt);
        },

        formatPerformanceLabel(stageName, startAt, endAt) {
            return formatter.formatPerformanceLabel(stageName, startAt, endAt);
        },

        formatAvatarSrc(data, mimeType) {
            return formatter.toAvatarSrc(data, mimeType);
        },

        formatInitials(name) {
            return formatter.formatInitials(name);
        },

        onOpenEditDetails() {
            const data = this.getView().getModel("detail") && this.getView().getModel("detail").getData();
            if (!data || !data.id) {
                return;
            }
            this._ensureFreshArtistData(data.id).then((fresh) => {
                const source = fresh || data;
                this._getEditModel().setData(this._mapDetailToEditModel(source));
                this._loadCountries();
                this._getEditDialog().then((dialog) => dialog.open());
            });
        },

        onCancelEditDetails() {
            this._getEditDialog().then((dialog) => dialog.close());
        },

        onSaveEditDetails() {
            const dialogPromise = this._getEditDialog();
            const model = this._getEditModel();
            const form = model.getData();
            if (!form.id) {
                MessageToast.show("Artist ID missing; reopen detail and try again.");
                return;
            }
            const errors = this._validateEdit(form);
            model.setProperty("/errors", errors);
            if (errors.name || errors.countryId || errors.genres) {
                MessageToast.show("Fill the required fields.");
                return;
            }
            dialogPromise.then((dialog) => dialog.setBusy(true));
            const payload = {
                name: form.name,
                genres: form.genres || [],
                country_ID: form.countryId || "",
                spotifyUrl: form.spotifyUrl || "",
                instagramHandle: form.instagramHandle || "",
                biography: form.biography || ""
            };
            if (form.avatarChanged) {
                payload.avatar = form.avatar || "";
                payload.avatarMimeType = form.avatarMimeType || "";
            }
            const oDataModel = this.getView().getModel();
            const serviceUrl = oDataModel && oDataModel.sServiceUrl ? oDataModel.sServiceUrl : "";
            const url = `${serviceUrl}/Artists('${form.id}')`;
            fetch(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).then((res) => {
                if (!res.ok) {
                    throw new Error(`Update failed ${res.status}`);
                }
                return this._refreshDetail(form.id);
            }).then((artist) => {
                dialogPromise.then((dialog) => dialog.setBusy(false));
                dialogPromise.then((dialog) => dialog.close());
                const detailData = artist || this.getView().getModel("detail").getData();
                sap.ui.getCore().getEventBus().publish("artist", "updated", { id: form.id });
                MessageToast.show("Artist updated");
            }).catch((err) => {
                dialogPromise.then((dialog) => dialog.setBusy(false));
                MessageToast.show("Update failed");
                // eslint-disable-next-line no-console
                console.error("Edit artist failed", err);
            });
        },

        onEditAvatarSelected(event) {
            const files = event.getParameter("files");
            const file = files && files[0];
            if (!file) {
                return;
            }
            if (!file.type || !file.type.startsWith("image/")) {
                MessageToast.show("Select an image file.");
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e && e.target && e.target.result;
                if (typeof result !== "string") {
                    return;
                }
                this._downscaleAvatar(result).then(({ dataUrl, mimeType }) => {
                    const model = this._getEditModel();
                    model.setProperty("/avatar", dataUrl.split(",")[1] || "");
                    model.setProperty("/avatarMimeType", mimeType || file.type || "image/jpeg");
                    model.setProperty("/avatarChanged", true);
                }).catch(() => {
                    MessageToast.show("Avatar upload failed.");
                });
            };
            reader.readAsDataURL(file);
        },

        onEditAvatarClear() {
            const model = this._getEditModel();
            model.setProperty("/avatar", "");
            model.setProperty("/avatarMimeType", "");
            model.setProperty("/avatarChanged", true);
        },

        onOpenAddReview() {
            const detailModel = this.getView().getModel("detail");
            const performances = detailModel.getProperty("/performances") || [];
            if (!performances.length) {
                MessageToast.show("Add a performance before creating a review.");
                return;
            }
            const defaultPerformanceId = performances.length > 0 ? performances[0].id : "";
            const today = new Date().toISOString().slice(0, 10);
            this._getReviewModel().setData({
                performanceId: defaultPerformanceId,
                rating: 0,
                comment: "",
                customerName: "",
                date: today
            });
            this._getReviewDialog().then((dialog) => dialog.open());
        },

        onCancelAddReview() {
            this._getReviewDialog().then((dialog) => dialog.close());
        },

        onSaveReview() {
            const reviewData = this._getReviewModel().getData();
            if (!reviewData.performanceId) {
                MessageToast.show("Select a performance");
                return;
            }
            if (!reviewData.rating || reviewData.rating <= 0) {
                MessageToast.show("Select a rating");
                return;
            }
            if (!reviewData.customerName) {
                MessageToast.show("Enter a customer name");
                return;
            }
            if (!reviewData.date) {
                MessageToast.show("Select a date");
                return;
            }
            const dialogPromise = this._getReviewDialog();
            dialogPromise.then((dialog) => dialog.setBusy(true));

            const payload = {
                rating: Math.round(reviewData.rating),
                comment: reviewData.comment || "",
                date: reviewData.date,
                customerName: reviewData.customerName,
                performance_ID: reviewData.performanceId
            };

            const oDataModel = this.getView().getModel();
            const listBinding = oDataModel.bindList("/Reviews");
            const context = listBinding.create(payload);
            context.created().then(() => context.requestObject()).then((createdReview) => {
                dialogPromise.then((dialog) => dialog.setBusy(false));
                dialogPromise.then((dialog) => dialog.close());
                this._appendReview(createdReview);
                this._refreshData();
                MessageToast.show("Review saved");
            }).catch((err) => {
                dialogPromise.then((dialog) => dialog.setBusy(false));
                MessageToast.show("Save failed");
                // eslint-disable-next-line no-console
                console.error("Create review failed", err);
            });
        },

        onOpenManagePerformances() {
            const detailModel = this.getView().getModel("detail");
            const artistId = detailModel && detailModel.getProperty("/id");
            if (!artistId) {
                MessageToast.show("Select an artist first.");
                return;
            }
            const perfModel = this._getPerformanceModel();
            perfModel.setData({
                artistId,
                performances: [],
                deletedIds: [],
                options: { stages: [] }
            });
            Promise.all([this._loadStageOptions(), this._loadPerformancesForEditing(artistId)]).then(() => {
                this._validatePerformanceForm();
                this._getPerformanceDialog().then((dialog) => dialog.open());
            }).catch((err) => {
                MessageToast.show("Unable to load performances.");
                console.error("Load performances failed", err);
            });
        },

        onAddPerformanceRow() {
            const perfModel = this._getPerformanceModel();
            const rows = perfModel.getProperty("/performances") || [];
            rows.push(this._getEmptyPerformanceRow());
            perfModel.setProperty("/performances", rows);
            this._validatePerformanceForm();
        },

        onRemovePerformanceRow(event) {
            const context = event.getSource().getBindingContext("performanceModel");
            if (!context) {
                return;
            }
            const path = context.getPath();
            const index = Number(path.split("/").pop());
            const perfModel = this._getPerformanceModel();
            const rows = perfModel.getProperty("/performances") || [];
            const deletedIds = perfModel.getProperty("/deletedIds") || [];
            const removed = rows.splice(index, 1)[0];
            if (removed && removed.id) {
                deletedIds.push(removed.id);
            }
            perfModel.setProperty("/performances", rows);
            perfModel.setProperty("/deletedIds", deletedIds);
            this._validatePerformanceForm();
        },

        onManagePerformanceFieldChange() {
            this._validatePerformanceForm();
        },

        onCancelManagePerformances() {
            this._getPerformanceDialog().then((dialog) => dialog.close());
        },

        onSaveManagePerformances() {
            const perfModel = this._getPerformanceModel();
            const data = perfModel.getData();
            if (!this._validatePerformanceForm()) {
                MessageToast.show("Fix the performance details.");
                return;
            }
            const dialogPromise = this._getPerformanceDialog();
            dialogPromise.then((dialog) => dialog.setBusy(true));
            const operations = [];
            (data.deletedIds || []).forEach((id) => {
                operations.push(() => this._deletePerformance(id));
            });
            (data.performances || []).forEach((perf) => {
                if (perf.id) {
                    operations.push(() => this._updatePerformance(perf));
                } else {
                    operations.push(() => this._createPerformance(perf, data.artistId));
                }
            });
            operations.reduce((prev, op) => prev.then(() => op()), Promise.resolve()).then(() => {
                dialogPromise.then((dialog) => dialog.setBusy(false));
                dialogPromise.then((dialog) => dialog.close());
                return this._refreshPerformancesAfterSave(data.artistId);
            }).then(() => {
                MessageToast.show("Performances updated");
            }).catch((err) => {
                dialogPromise.then((dialog) => dialog.setBusy(false));
                MessageToast.show("Could not save performances");
                console.error("Manage performances failed", err);
            });
        },

        _appendReview(createdReview) {
            const detailModel = this.getView().getModel("detail");
            const reviews = detailModel.getProperty("/reviews") || [];
            reviews.push({
                id: createdReview.ID || createdReview.id || "",
                rating: createdReview.rating,
                comment: createdReview.comment,
                date: createdReview.date,
                customerName: createdReview.customerName
            });
            reviews.sort((a, b) => {
                const aDate = a.date ? new Date(a.date).getTime() : 0;
                const bDate = b.date ? new Date(b.date).getTime() : 0;
                return bDate - aDate;
            });
            detailModel.setProperty("/reviews", reviews);
            this._updatePopularityFromReviews(reviews);
        },

        _refreshData() {
            const model = this.getView().getModel();
            if (model && model.refresh) {
                model.refresh();
            }
        },

        _refreshDetail(artistId) {
            const oDataModel = this.getView().getModel();
            const binding = oDataModel.bindContext(`/Artists('${artistId}')`, undefined, {
                $select: "ID,name,spotifyUrl,instagramHandle,biography,genres,country_ID,avatar,avatarMimeType",
                $expand: "country($select=ID,name)"
            });
            return binding.requestObject().then((artist) => {
                if (!artist) {
                    return;
                }
                const detailModel = this.getView().getModel("detail");
                const currentAvatar = detailModel.getProperty("/avatar");
                const currentAvatarMime = detailModel.getProperty("/avatarMimeType");
                const needFetch = artist.avatar === undefined || artist.avatar === null;
                const avatarPromise = needFetch ? this._fetchAvatarBase64(artistId, artist.avatarMimeType || artist["avatar@odata.mediaContentType"] || currentAvatarMime || "image/jpeg").catch(() => null) : Promise.resolve({ data: artist.avatar, mime: artist.avatarMimeType || artist["avatar@odata.mediaContentType"] });
                return avatarPromise.then((avatarObj) => {
                    const rawAvatar = avatarObj && avatarObj.data !== undefined ? avatarObj.data : artist.avatar !== undefined ? artist.avatar : currentAvatar || null;
                    const avatarData = this._normalizeAvatar(rawAvatar);
                    const avatarMime = avatarObj && avatarObj.mime !== undefined ? avatarObj.mime : artist.avatarMimeType !== undefined ? artist.avatarMimeType : artist["avatar@odata.mediaContentType"] || currentAvatarMime || "";
                    detailModel.setProperty("/name", artist.name || "");
                    detailModel.setProperty("/id", artist.ID || artist.id || artistId);
                    detailModel.setProperty("/spotifyUrl", artist.spotifyUrl || "");
                    detailModel.setProperty("/instagramHandle", artist.instagramHandle || "");
                    detailModel.setProperty("/biography", artist.biography || "");
                    detailModel.setProperty("/genres", artist.genres || []);
                    detailModel.setProperty("/country", (artist.country && artist.country.name) || "");
                    detailModel.setProperty("/avatar", avatarData || null);
                    detailModel.setProperty("/avatarMimeType", avatarMime);
                    detailModel.setProperty("/countryId", (artist.country && artist.country.ID) || artist.country_ID || "");
                    return Object.assign({}, artist, { avatar: avatarData, avatarMimeType: avatarMime });
                });
            });
        },

        _ensureFreshArtistData(artistId) {
            const oDataModel = this.getView().getModel();
            const binding = oDataModel.bindContext(`/Artists('${artistId}')`, undefined, {
                $select: "ID,name,spotifyUrl,instagramHandle,biography,genres,country_ID,avatar,avatarMimeType",
                $expand: "country($select=ID,name)"
            });
            return binding.requestObject().then((artist) => {
                if (!artist) {
                    return null;
                }
                if (artist.avatar !== undefined && artist.avatar !== null) {
                    artist.avatar = this._normalizeAvatar(artist.avatar);
                    if (!artist.avatarMimeType) {
                        artist.avatarMimeType = artist["avatar@odata.mediaContentType"] || "";
                    }
                    return artist;
                }
                return this._fetchAvatarBase64(artistId, artist.avatarMimeType || artist["avatar@odata.mediaContentType"] || "image/jpeg").then((avatarObj) => {
                    if (avatarObj) {
                        artist.avatar = avatarObj.data;
                        artist.avatarMimeType = avatarObj.mime;
                    }
                    return artist;
                }).catch(() => artist);
            }).catch(() => null);
        },

        _getPerformanceDialog() {
            if (!this._performanceDialogPromise) {
                this._performanceDialogPromise = Fragment.load({
                    id: this.getView().getId(),
                    name: "artistmanagement.fragments.ManagePerformances",
                    controller: this
                }).then((dialog) => {
                    dialog.setModel(this._getPerformanceModel(), "performanceModel");
                    dialog.setModel(this.getView().getModel("detail"), "detail");
                    this.getView().addDependent(dialog);
                    return dialog;
                });
            }
            return this._performanceDialogPromise;
        },

        _getPerformanceModel() {
            if (!this._performanceModel) {
                this._performanceModel = new JSONModel({
                    artistId: "",
                    performances: [],
                    deletedIds: [],
                    options: {
                        stages: []
                    }
                });
            }
            return this._performanceModel;
        },

        _getEmptyPerformanceRow() {
            return {
                id: "",
                stageId: "",
                stageName: "",
                day: "",
                startTime: "",
                endTime: "",
                original: null,
                errors: {
                    stageId: "",
                    day: "",
                    startTime: "",
                    endTime: "",
                    timeRange: ""
                }
            };
        },

        _loadStageOptions() {
            const oDataModel = this.getView().getModel();
            if (!oDataModel) {
                return Promise.resolve();
            }
            const binding = oDataModel.bindList("/Stages", undefined, undefined, undefined, {
                $select: "ID,name"
            });
            return binding.requestContexts(0, 200).then((contexts) => {
                const stages = contexts.map((ctx) => ({
                    key: ctx.getProperty("ID") || "",
                    text: ctx.getProperty("name") || ""
                }));
                this._getPerformanceModel().setProperty("/options/stages", stages);
            }).catch(() => {
                this._getPerformanceModel().setProperty("/options/stages", []);
            });
        },

        _fetchPerformances(artistId) {
            const oDataModel = this.getView().getModel();
            if (!oDataModel) {
                return Promise.resolve([]);
            }
            const binding = oDataModel.bindList("/Performances", undefined, undefined, [
                new Filter("artist/ID", FilterOperator.EQ, artistId)
            ], {
                $select: "ID,startAt,endAt,stage_ID",
                $expand: "stage($select=ID,name)"
            });
            return binding.requestContexts(0, 200).then((contexts) => {
                const performances = contexts.map((ctx) => {
                    const perf = ctx.getObject();
                    return {
                        id: perf.ID || perf.id || "",
                        startAt: perf.startAt,
                        endAt: perf.endAt,
                        stageId: perf.stage_ID || (perf.stage && perf.stage.ID) || "",
                        stageName: (perf.stage && perf.stage.name) || ""
                    };
                });
                performances.sort((a, b) => {
                    const aDate = a.startAt ? new Date(a.startAt).getTime() : 0;
                    const bDate = b.startAt ? new Date(b.startAt).getTime() : 0;
                    return aDate - bDate;
                });
                return performances;
            }).catch(() => []);
        },

        _loadPerformancesForEditing(artistId) {
            return this._fetchPerformances(artistId).then((performances) => {
                const rows = performances.map((perf) => this._mapPerformanceToForm(perf));
                const perfModel = this._getPerformanceModel();
                perfModel.setProperty("/performances", rows);
                perfModel.setProperty("/deletedIds", []);
                this._setDetailPerformances(performances);
                return performances;
            });
        },

        _mapPerformanceToForm(perf) {
            const start = perf.startAt ? new Date(perf.startAt) : null;
            const end = perf.endAt ? new Date(perf.endAt) : null;
            const day = start ? start.toISOString().slice(0, 10) : "";
            const startTime = start ? start.toISOString().slice(11, 16) : "";
            const endTime = end ? end.toISOString().slice(11, 16) : "";
            return {
                id: perf.id || "",
                stageId: perf.stageId || "",
                stageName: perf.stageName || "",
                day,
                startTime,
                endTime,
                original: {
                    stageId: perf.stageId || "",
                    day,
                    startTime,
                    endTime
                },
                errors: {
                    stageId: "",
                    day: "",
                    startTime: "",
                    endTime: "",
                    timeRange: ""
                }
            };
        },

        _validatePerformanceForm() {
            const perfModel = this._getPerformanceModel();
            const rows = perfModel.getProperty("/performances") || [];
            let valid = true;
            rows.forEach((row, index) => {
                const errors = {
                    stageId: row.stageId ? "" : "Choose a stage",
                    day: row.day ? "" : "Select a day",
                    startTime: row.startTime ? "" : "Select a start time",
                    endTime: row.endTime ? "" : "Select an end time",
                    timeRange: ""
                };
                if (row.day && row.startTime && row.endTime) {
                    const startDate = this._combineDateAndTime(row.day, row.startTime);
                    const endDate = this._combineDateAndTime(row.day, row.endTime);
                    if (startDate >= endDate) {
                        errors.timeRange = "End time must be after start time";
                    }
                }
                perfModel.setProperty(`/performances/${index}/errors`, errors);
                if (errors.stageId || errors.day || errors.startTime || errors.endTime || errors.timeRange) {
                    valid = false;
                }
            });
            return valid;
        },

        _combineDateAndTime(day, time) {
            const [year, month, date] = (day || "").split("-").map(Number);
            const [hours, minutes] = (time || "").split(":").map(Number);
            return new Date(Date.UTC(year || 0, (month || 1) - 1, date || 1, hours || 0, minutes || 0));
        },

        _deletePerformance(performanceId) {
            if (!performanceId) {
                return Promise.resolve();
            }
            const oDataModel = this.getView().getModel();
            const serviceUrl = oDataModel && oDataModel.sServiceUrl ? oDataModel.sServiceUrl : "";
            const url = `${serviceUrl}/Performances('${performanceId}')`;
            return fetch(url, {
                method: "DELETE"
            }).then((res) => {
                if (!res.ok) {
                    throw new Error(`Delete failed ${res.status}`);
                }
            });
        },

        _updatePerformance(perf) {
            if (!perf || !perf.id) {
                return Promise.resolve();
            }
            const original = perf.original || {};
            if (original.stageId === perf.stageId && original.day === perf.day && original.startTime === perf.startTime && original.endTime === perf.endTime) {
                return Promise.resolve();
            }
            const startAt = this._combineDateAndTime(perf.day, perf.startTime).toISOString();
            const endAt = this._combineDateAndTime(perf.day, perf.endTime).toISOString();
            const payload = {
                startAt,
                endAt,
                stage_ID: perf.stageId
            };
            const oDataModel = this.getView().getModel();
            const serviceUrl = oDataModel && oDataModel.sServiceUrl ? oDataModel.sServiceUrl : "";
            const url = `${serviceUrl}/Performances('${perf.id}')`;
            return fetch(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).then((res) => {
                if (!res.ok) {
                    throw new Error(`Update failed ${res.status}`);
                }
            });
        },

        _createPerformance(perf, artistId) {
            if (!perf || !artistId) {
                return Promise.resolve();
            }
            const startAt = this._combineDateAndTime(perf.day, perf.startTime).toISOString();
            const endAt = this._combineDateAndTime(perf.day, perf.endTime).toISOString();
            const payload = {
                startAt,
                endAt,
                stage_ID: perf.stageId,
                artist_ID: artistId
            };
            const oDataModel = this.getView().getModel();
            const listBinding = oDataModel.bindList("/Performances");
            const context = listBinding.create(payload);
            return context.created().then(() => context.requestObject()).then((created) => created).catch((err) => {
                throw err;
            });
        },

        _refreshPerformancesAfterSave(artistId) {
            return this._fetchPerformances(artistId).then((performances) => {
                this._setDetailPerformances(performances);
                return this._refreshReviews(artistId);
            }).then(() => {
                sap.ui.getCore().getEventBus().publish("artist", "updated", { id: artistId });
            });
        },

        _setDetailPerformances(performances) {
            const detailModel = this.getView().getModel("detail");
            if (!detailModel) {
                return;
            }
            detailModel.setProperty("/performances", performances.map((perf) => ({
                id: perf.id,
                startAt: perf.startAt,
                endAt: perf.endAt,
                stageName: perf.stageName || this._findStageName(perf.stageId),
                stageId: perf.stageId
            })));
        },

        _findStageName(stageId) {
            const stages = (this._performanceModel && this._performanceModel.getProperty("/options/stages")) || [];
            const match = stages.find((s) => s.key === stageId);
            return (match && match.text) || "";
        },

        _refreshReviews(artistId) {
            const detailModel = this.getView().getModel("detail");
            if (!artistId) {
                return Promise.resolve();
            }
            const oDataModel = this.getView().getModel();
            const reviewsBinding = oDataModel.bindList("/Reviews", undefined, undefined, [
                new Filter("performance/artist/ID", FilterOperator.EQ, artistId)
            ], {
                $select: "ID,rating,date,comment,customerName"
            });
            return reviewsBinding.requestContexts(0, 200).then((contexts) => {
                const reviews = contexts.map((ctx) => {
                    const review = ctx.getObject();
                    return {
                        id: review.ID || review.id || "",
                        rating: review.rating,
                        comment: review.comment,
                        date: review.date,
                        customerName: review.customerName
                    };
                });
                reviews.sort((a, b) => {
                    const aDate = a.date ? new Date(a.date).getTime() : 0;
                    const bDate = b.date ? new Date(b.date).getTime() : 0;
                    return bDate - aDate;
                });
                if (detailModel) {
                    detailModel.setProperty("/reviews", reviews);
                }
                this._updatePopularityFromReviews(reviews);
                return reviews;
            }).catch(() => {
                if (detailModel) {
                    detailModel.setProperty("/reviews", []);
                }
                this._updatePopularityFromReviews([]);
                return [];
            });
        },

        _getReviewModel() {
            if (!this._reviewModel) {
                this._reviewModel = new JSONModel({
                    performanceId: "",
                    rating: 0,
                    comment: "",
                    customerName: "",
                    date: ""
                });
            }
            return this._reviewModel;
        },

        _getReviewDialog() {
            if (!this._reviewDialogPromise) {
                this._reviewDialogPromise = Fragment.load({
                    id: this.getView().getId(),
                    name: "artistmanagement.fragments.AddReview",
                    controller: this
                }).then((dialog) => {
                    dialog.setModel(this._getReviewModel(), "reviewForm");
                    dialog.setModel(this.getView().getModel("detail"), "detail");
                    this.getView().addDependent(dialog);
                    return dialog;
                });
            }
            return this._reviewDialogPromise;
        },

        _getEditDialog() {
            if (!this._editDialogPromise) {
                this._editDialogPromise = Fragment.load({
                    id: this.getView().getId(),
                    name: "artistmanagement.fragments.EditArtistDetails",
                    controller: this
                }).then((dialog) => {
                    dialog.setModel(this._getEditModel(), "editModel");
                    this.getView().addDependent(dialog);
                    return dialog;
                });
            }
            return this._editDialogPromise;
        },

        _getEditModel() {
            if (!this._editModel) {
                this._editModel = new JSONModel({
                    id: "",
                    name: "",
                    genres: [],
                    countryId: "",
                    spotifyUrl: "",
                    instagramHandle: "",
                    biography: "",
                    avatar: "",
                    avatarMimeType: "",
                    avatarChanged: false,
                    options: {
                        genres: this._getGenreOptions(),
                        countries: []
                    },
                    errors: {}
                });
            }
            return this._editModel;
        },

        _mapDetailToEditModel(detailData) {
            const detailModel = this.getView().getModel("detail");
            const rawAvatar = detailData.avatar !== undefined ? detailData.avatar : (detailModel && detailModel.getProperty("/avatar"));
            const avatarMime = detailData.avatarMimeType !== undefined ? detailData.avatarMimeType : detailData["avatar@odata.mediaContentType"] || (detailModel && detailModel.getProperty("/avatarMimeType")) || "";
                return {
                    id: detailData.id || detailData.ID || (detailModel && detailModel.getProperty("/id")) || "",
                    name: detailData.name || "",
                    genres: Array.isArray(detailData.genres) ? detailData.genres.slice() : [],
                    countryId: detailData.countryId || detailData.country_ID || (detailData.country && detailData.country.ID) || "",
                    spotifyUrl: detailData.spotifyUrl || "",
                    instagramHandle: detailData.instagramHandle || "",
                    biography: detailData.biography || "",
                    avatar: this._normalizeAvatar(rawAvatar),
                    avatarMimeType: avatarMime,
                    avatarChanged: false,
                    options: {
                        genres: this._getGenreOptions(),
                        countries: this._getEditModel().getProperty("/options/countries") || []
                    },
                    errors: {}
                };
        },

        _normalizeAvatar(value) {
            if (!value) {
                return "";
            }
            if (typeof value === "string") {
                if (value.startsWith("data:")) {
                    const parts = value.split(",");
                    return parts[1] || "";
                }
                return value;
            }
            return "";
        },

        _getGenreOptions() {
            const keys = ["POP", "ROCK", "HIPHOP", "EDM", "TECHNO", "HOUSE", "JAZZ", "CLASSICAL", "RNB", "INDIE", "METAL", "LATIN", "AFROBEATS", "FOLK", "BLUES", "FUNK", "COUNTRY"];
            return keys.map((key) => ({ key, text: formatter.formatGenre(key) }));
        },

        _loadCountries() {
            const oDataModel = this.getView().getModel();
            const binding = oDataModel.bindList("/Countries", undefined, undefined, undefined, {
                $select: "ID,name"
            });
            return binding.requestContexts(0, 200).then((contexts) => {
                const countries = contexts.map((ctx) => ({
                    key: ctx.getProperty("ID") || "",
                    text: ctx.getProperty("name") || ""
                }));
                this._getEditModel().setProperty("/options/countries", countries);
            }).catch(() => {
                this._getEditModel().setProperty("/options/countries", []);
            });
        },

        _validateEdit(form) {
            return {
                name: form.name ? "" : "Enter the artist name",
                countryId: form.countryId ? "" : "Select a country",
                genres: Array.isArray(form.genres) && form.genres.length > 0 ? "" : "Select at least one genre"
            };
        },

        _downscaleAvatar(dataUrl) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const maxSize = 256;
                    let { width, height } = img;
                    if (!width || !height) {
                        reject();
                        return;
                    }
                    if (width > height && width > maxSize) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    } else if (height >= width && height > maxSize) {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        reject();
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    const mimeType = "image/jpeg";
                    const compressed = canvas.toDataURL(mimeType, 0.85);
                    resolve({ dataUrl: compressed, mimeType });
                };
                img.onerror = () => reject();
                img.src = dataUrl;
            });
        },

        _fetchAvatarBase64(artistId, mime) {
            const oDataModel = this.getView().getModel();
            const serviceUrl = oDataModel && oDataModel.sServiceUrl ? oDataModel.sServiceUrl : "";
            const url = `${serviceUrl}/Artists('${artistId}')/avatar/$value`;
            return fetch(url).then((res) => {
                if (!res.ok) {
                    throw new Error("avatar fetch failed");
                }
                return res.blob();
            }).then((blob) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result;
                    if (typeof result !== "string") {
                        reject();
                        return;
                    }
                    const base64 = result.split(",")[1] || "";
                    resolve({ data: base64, mime: mime || blob.type || "image/jpeg" });
                };
                reader.onerror = () => reject();
                reader.readAsDataURL(blob);
            }));
        },

        _applyEditToDetailModel(form) {
            const detailModel = this.getView().getModel("detail");
            detailModel.setProperty("/name", form.name || "");
            detailModel.setProperty("/genres", form.genres || []);
            detailModel.setProperty("/country", this._findCountryName(form.countryId));
            detailModel.setProperty("/countryId", form.countryId || "");
            detailModel.setProperty("/spotifyUrl", form.spotifyUrl || "");
            detailModel.setProperty("/instagramHandle", form.instagramHandle || "");
            detailModel.setProperty("/biography", form.biography || "");
            detailModel.setProperty("/avatar", form.avatar || null);
            detailModel.setProperty("/avatarMimeType", form.avatarMimeType || "");
        },

        _findCountryName(id) {
            const countries = (this._editModel && this._editModel.getProperty("/options/countries")) || [];
            const match = countries.find((c) => c.key === id);
            return (match && match.text) || "";
        },

        _downscaleAvatar(dataUrl) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const maxSize = 256;
                    let { width, height } = img;
                    if (!width || !height) {
                        reject();
                        return;
                    }
                    if (width > height && width > maxSize) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    } else if (height >= width && height > maxSize) {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        reject();
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    const mimeType = "image/jpeg";
                    const compressed = canvas.toDataURL(mimeType, 0.82);
                    resolve({ dataUrl: compressed, mimeType });
                };
                img.onerror = () => reject();
                img.src = dataUrl;
            });
        },

        _updatePopularityFromReviews(reviews) {
            if (!Array.isArray(reviews) || reviews.length === 0) {
                this.getView().getModel("detail").setProperty("/popularityScore", 0);
                return;
            }
            const validRatings = reviews.map((r) => Number(r.rating)).filter((r) => !Number.isNaN(r));
            if (validRatings.length === 0) {
                return;
            }
            const avg = validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length;
            this.getView().getModel("detail").setProperty("/popularityScore", Number(avg.toFixed(1)));
        }
    });
});
