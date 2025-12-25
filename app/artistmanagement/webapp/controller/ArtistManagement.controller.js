sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library"
], (Controller, JSONModel, fLibrary) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;

    return Controller.extend("artistmanagement.controller.ArtistManagement", {
        onInit() {
            const detailModel = new JSONModel({ name: "Select an artist", id: "", spotifyUrl: "", instagramHandle: "" });
            this.getView().setModel(detailModel, "detail");
            const detailView = this.byId("detailView");
            if (detailView) {
                detailView.setModel(detailModel, "detail");
            }
            this._fcl = this.byId("fcl");
        },

        onSelectArtist(event) {
            const context = event.getParameter("listItem").getBindingContext();
            if (!context) {
                return;
            }
            const data = context.getObject();
            const detailModel = this.getView().getModel("detail");
            detailModel.setData({
                name: data.name,
                id: data.ID || data.id || "",
                spotifyUrl: data.spotifyUrl || "",
                instagramHandle: data.instagramHandle || ""
            });
            this._fcl.setLayout(LayoutType.TwoColumnsMidExpanded);
        },

        formatGenre(value) {
            if (!value) {
                return "";
            }
            const map = {
                HIPHOP: "Hip Hop",
                RNB: "R&B",
                EDM: "EDM",
                POP: "Pop",
                ROCK: "Rock",
                TECHNO: "Techno",
                HOUSE: "House",
                JAZZ: "Jazz",
                CLASSICAL: "Classical",
                INDIE: "Indie",
                METAL: "Metal",
                LATIN: "Latin",
                AFROBEATS: "Afrobeats",
                FOLK: "Folk",
                BLUES: "Blues",
                FUNK: "Funk",
                COUNTRY: "Country"
            };
            return map[value] || value;
        }
    });
});
