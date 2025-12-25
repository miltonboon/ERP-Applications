sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/library"
], (Controller, fLibrary) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;

    return Controller.extend("artistmanagement.controller.ArtistDetail", {
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
        }
    });
});
