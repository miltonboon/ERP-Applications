sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/LayoutType"
], (Controller, LayoutType) => {
    "use strict";

    return Controller.extend("artistmanagement.controller.ArtistDetail", {
        onCloseDetail() {
            const fcl = this.getView().getParent();
            if (fcl && fcl.setLayout) {
                fcl.setLayout(LayoutType.OneColumn);
            }
        }
    });
});
