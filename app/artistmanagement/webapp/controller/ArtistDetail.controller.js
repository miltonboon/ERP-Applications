sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/f/library",
    "artistmanagement/model/formatter"
], (Controller, fLibrary, formatter) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;

    return Controller.extend("artistmanagement.controller.ArtistDetail", {
        formatter,

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
        }
    });
});
