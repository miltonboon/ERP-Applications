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
    const dateTimeFormatter = DateFormat.getDateTimeInstance({
        pattern: "MMM d, yyyy, HH:mm",
        UTC: true
    });
    const timeFormatter = DateFormat.getTimeInstance({
        pattern: "HH:mm",
        UTC: true
    });

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
        },

        formatDateTime(value) {
            if (!value) {
                return "";
            }
            try {
                const parsed = new Date(value);
                return dateTimeFormatter.format(parsed);
            } catch (e) {
                return value;
            }
        },

        formatPerformanceSlot(startAt, endAt) {
            if (!startAt) {
                return "";
            }
            try {
                const start = new Date(startAt);
                const end = endAt ? new Date(endAt) : null;
                if (end) {
                    return `${dateTimeFormatter.format(start)} - ${timeFormatter.format(end)}`;
                }
                return dateTimeFormatter.format(start);
            } catch (e) {
                if (endAt) {
                    return `${startAt} - ${endAt}`;
                }
                return startAt;
            }
        },

        formatPerformanceLabel(stageName, startAt, endAt) {
            const slot = this.formatPerformanceSlot(startAt, endAt);
            if (stageName && slot) {
                return `${stageName} (${slot})`;
            }
            if (stageName) {
                return stageName;
            }
            return slot;
        }
    };
});
