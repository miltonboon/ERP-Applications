sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/LayoutType"
], (Controller, LayoutType) => {
    "use strict";

    return Controller.extend("artistmanagement.controller.ArtistDetail", {
        onCloseDetail() {
            let parent = this.getView().getParent();
            while (parent && !parent.isA("sap.f.FlexibleColumnLayout")) {
                parent = parent.getParent();
            }
            if (parent && parent.setLayout) {
                parent.setLayout(LayoutType.OneColumn);
            }
        }
    });
});
