sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/library",
    "artistmanagement/model/formatter",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "artistmanagement/controller/util/EditArtist",
    "artistmanagement/controller/util/ManagePerformances"
], (Controller, fLibrary, formatter, Fragment, JSONModel, MessageToast, EditArtist, ManagePerformances) => {
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

        formatPerformanceSlot(dayLabel, startTime, endTime, date) {
            return formatter.formatPerformanceSlot(dayLabel, startTime, endTime, date);
        },

        formatPerformanceLabel(stageName, dayLabel, startTime, endTime, date) {
            return formatter.formatPerformanceLabel(stageName, dayLabel, startTime, endTime, date);
        },

        formatAvatarSrc(data, mimeType) {
            return formatter.toAvatarSrc(data, mimeType);
        },

        formatInitials(name) {
            return formatter.formatInitials(name);
        },

        onOpenEditDetails() {
            EditArtist.openEditDetails(this);
        },

        onCancelEditDetails() {
            EditArtist.cancelEditDetails(this);
        },

        onSaveEditDetails() {
            EditArtist.saveEditDetails(this);
        },

        onEditAvatarSelected(event) {
            EditArtist.onEditAvatarSelected(this, event);
        },

        onEditAvatarClear() {
            EditArtist.clearEditAvatar(this);
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
            ManagePerformances.openManagePerformances(this);
        },

        onAddPerformanceRow() {
            ManagePerformances.addPerformanceRow(this);
        },

        onRemovePerformanceRow(event) {
            ManagePerformances.removePerformanceRow(this, event);
        },

        onManagePerformanceFieldChange() {
            ManagePerformances.managePerformanceFieldChange(this);
        },

        onCancelManagePerformances() {
            ManagePerformances.cancelManagePerformances(this);
        },

        onSaveManagePerformances() {
            ManagePerformances.saveManagePerformances(this);
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
                    name: "artistmanagement.fragment.AddReview",
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
