sap.ui.define([
    "sap/ui/core/format/DateFormat"
], (DateFormat) => {
    "use strict";

    const genreMap = {
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

    const dateFormatter = DateFormat.getDateInstance({ style: "medium" });

    return {
        formatGenre(value) {
            if (!value) {
                return "";
            }
            return genreMap[value] || value;
        },

        formatDate(value) {
            if (!value) {
                return "";
            }
            try {
                const parsed = new Date(value);
                return dateFormatter.format(parsed);
            } catch (e) {
                return value;
            }
        }
    };
});
