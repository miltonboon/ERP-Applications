sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/LayoutType"
], (Controller, JSONModel, LayoutType) => {
    "use strict";

    return Controller.extend("artistmanagement.controller.ArtistManagement", {
        onInit() {
            const detailModel = new JSONModel({ name: "Select an artist", id: "" });
            this.getView().setModel(detailModel, "detail");
            this._fcl = this.byId("fcl");
        },

        onSelectArtist(event) {
            const context = event.getParameter("listItem").getBindingContext();
            if (!context) {
                return;
            }
            const data = context.getObject();
            this.getView().getModel("detail").setData({
                name: data.name,
                id: data.ID || data.id || ""
            });
            this._fcl.setLayout(LayoutType.TwoColumnsMidExpanded);
        },

        onCloseDetail() {
            this._fcl.setLayout(LayoutType.OneColumn);
        }
    });
});
