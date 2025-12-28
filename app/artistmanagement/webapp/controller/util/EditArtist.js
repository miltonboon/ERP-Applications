sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "artistmanagement/model/formatter",
    "./Avatar"
], (Fragment, JSONModel, MessageToast, formatter, AvatarUtil) => {
    "use strict";

    const GENRE_KEYS = ["POP", "ROCK", "HIPHOP", "EDM", "TECHNO", "HOUSE", "JAZZ", "CLASSICAL", "RNB", "INDIE", "METAL", "LATIN", "AFROBEATS", "FOLK", "BLUES", "FUNK", "COUNTRY"];

    const getGenreOptions = () => GENRE_KEYS.map((key) => ({ key, text: formatter.formatGenre(key) }));

    const getEditModel = (controller) => {
        if (!controller._editModel) {
            controller._editModel = new JSONModel({
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
                    genres: getGenreOptions(),
                    countries: []
                },
                errors: {}
            });
        }
        return controller._editModel;
    };

    const getEditDialog = (controller) => {
        if (!controller._editDialogPromise) {
            controller._editDialogPromise = Fragment.load({
                id: controller.getView().getId(),
                name: "artistmanagement.fragments.EditArtistDetails",
                controller
            }).then((dialog) => {
                dialog.setModel(getEditModel(controller), "editModel");
                controller.getView().addDependent(dialog);
                return dialog;
            });
        }
        return controller._editDialogPromise;
    };

    const normalizeAvatar = (value) => AvatarUtil.normalizeAvatar(value);

    const mapDetailToEditModel = (controller, detailData) => {
        const detailModel = controller.getView().getModel("detail");
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
            avatar: normalizeAvatar(rawAvatar),
            avatarMimeType: avatarMime,
            avatarChanged: false,
            options: {
                genres: getGenreOptions(),
                countries: getEditModel(controller).getProperty("/options/countries") || []
            },
            errors: {}
        };
    };

    const loadCountries = (controller) => {
        const oDataModel = controller.getView().getModel();
        const binding = oDataModel.bindList("/Countries", undefined, undefined, undefined, {
            $select: "ID,name"
        });
        return binding.requestContexts(0, 200).then((contexts) => {
            const countries = contexts.map((ctx) => ({
                key: ctx.getProperty("ID") || "",
                text: ctx.getProperty("name") || ""
            }));
            getEditModel(controller).setProperty("/options/countries", countries);
        }).catch(() => {
            getEditModel(controller).setProperty("/options/countries", []);
        });
    };

    const validateEdit = (form) => ({
        name: form.name ? "" : "Enter the artist name",
        countryId: form.countryId ? "" : "Select a country",
        genres: Array.isArray(form.genres) && form.genres.length > 0 ? "" : "Select at least one genre"
    });

    const downscaleAvatar = (dataUrl, quality) => AvatarUtil.downscaleAvatar(dataUrl, quality);

    const fetchAvatarBase64 = (controller, artistId, mime) => {
        const oDataModel = controller.getView().getModel();
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
    };

    const refreshDetail = (controller, artistId) => {
        const oDataModel = controller.getView().getModel();
        const binding = oDataModel.bindContext(`/Artists('${artistId}')`, undefined, {
            $select: "ID,name,spotifyUrl,instagramHandle,biography,genres,country_ID,avatar,avatarMimeType",
            $expand: "country($select=ID,name)"
        });
        return binding.requestObject().then((artist) => {
            if (!artist) {
                return;
            }
            const detailModel = controller.getView().getModel("detail");
            const currentAvatar = detailModel.getProperty("/avatar");
            const currentAvatarMime = detailModel.getProperty("/avatarMimeType");
            const needFetch = artist.avatar === undefined || artist.avatar === null;
            const avatarPromise = needFetch ? fetchAvatarBase64(controller, artistId, artist.avatarMimeType || artist["avatar@odata.mediaContentType"] || currentAvatarMime || "image/jpeg").catch(() => null) : Promise.resolve({ data: artist.avatar, mime: artist.avatarMimeType || artist["avatar@odata.mediaContentType"] });
            return avatarPromise.then((avatarObj) => {
                const rawAvatar = avatarObj && avatarObj.data !== undefined ? avatarObj.data : artist.avatar !== undefined ? artist.avatar : currentAvatar || null;
                const avatarData = normalizeAvatar(rawAvatar);
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
    };

    const ensureFreshArtistData = (controller, artistId) => {
        const oDataModel = controller.getView().getModel();
        const binding = oDataModel.bindContext(`/Artists('${artistId}')`, undefined, {
            $select: "ID,name,spotifyUrl,instagramHandle,biography,genres,country_ID,avatar,avatarMimeType",
            $expand: "country($select=ID,name)"
        });
        return binding.requestObject().then((artist) => {
            if (!artist) {
                return null;
            }
            if (artist.avatar !== undefined && artist.avatar !== null) {
                artist.avatar = normalizeAvatar(artist.avatar);
                if (!artist.avatarMimeType) {
                    artist.avatarMimeType = artist["avatar@odata.mediaContentType"] || "";
                }
                return artist;
            }
            return fetchAvatarBase64(controller, artistId, artist.avatarMimeType || artist["avatar@odata.mediaContentType"] || "image/jpeg").then((avatarObj) => {
                if (avatarObj) {
                    artist.avatar = avatarObj.data;
                    artist.avatarMimeType = avatarObj.mime;
                }
                return artist;
            }).catch(() => artist);
        }).catch(() => null);
    };

    const openEditDetails = (controller) => {
        const data = controller.getView().getModel("detail") && controller.getView().getModel("detail").getData();
        if (!data || !data.id) {
            return;
        }
        ensureFreshArtistData(controller, data.id).then((fresh) => {
            const source = fresh || data;
            getEditModel(controller).setData(mapDetailToEditModel(controller, source));
            loadCountries(controller);
            getEditDialog(controller).then((dialog) => dialog.open());
        });
    };

    const cancelEditDetails = (controller) => {
        getEditDialog(controller).then((dialog) => dialog.close());
    };

    const saveEditDetails = (controller) => {
        const dialogPromise = getEditDialog(controller);
        const model = getEditModel(controller);
        const form = model.getData();
        if (!form.id) {
            MessageToast.show("Artist ID missing; reopen detail and try again.");
            return;
        }
        const errors = validateEdit(form);
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
        const oDataModel = controller.getView().getModel();
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
            return refreshDetail(controller, form.id);
        }).then(() => {
            dialogPromise.then((dialog) => dialog.setBusy(false));
            dialogPromise.then((dialog) => dialog.close());
            sap.ui.getCore().getEventBus().publish("artist", "updated", { id: form.id });
            MessageToast.show("Artist updated");
        }).catch((err) => {
            dialogPromise.then((dialog) => dialog.setBusy(false));
            MessageToast.show("Update failed");
            // eslint-disable-next-line no-console
            console.error("Edit artist failed", err);
        });
    };

    const onEditAvatarSelected = (controller, event) => {
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
            downscaleAvatar(result, 0.82).then(({ dataUrl, mimeType }) => {
                const model = getEditModel(controller);
                model.setProperty("/avatar", dataUrl.split(",")[1] || "");
                model.setProperty("/avatarMimeType", mimeType || file.type || "image/jpeg");
                model.setProperty("/avatarChanged", true);
            }).catch(() => {
                MessageToast.show("Avatar upload failed.");
            });
        };
        reader.readAsDataURL(file);
    };

    const clearEditAvatar = (controller) => {
        const model = getEditModel(controller);
        model.setProperty("/avatar", "");
        model.setProperty("/avatarMimeType", "");
        model.setProperty("/avatarChanged", true);
    };

    return {
        openEditDetails,
        cancelEditDetails,
        saveEditDetails,
        onEditAvatarSelected,
        clearEditAvatar,
        getGenreOptions,
        normalizeAvatar,
        ensureFreshArtistData,
        refreshDetail
    };
});
