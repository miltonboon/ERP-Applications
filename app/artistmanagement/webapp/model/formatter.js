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

    const renderGenre = (v) => genreMap[v] || v || "";

    const dateFormatter = DateFormat.getDateInstance({ style: "medium" });
    const dateTimeFormatter = DateFormat.getDateTimeInstance({
        pattern: "MMM d, yyyy, HH:mm",
        UTC: true
    });
    const timeFormatter = DateFormat.getTimeInstance({
        pattern: "HH:mm",
        UTC: true
    });
    const dayFormatter = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
    });

    const parseDateValue = (value) => {
        if (!value) {
            return null;
        }
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
        const asUtc = new Date(`${value}T00:00:00Z`);
        if (!Number.isNaN(asUtc.getTime())) {
            return asUtc;
        }
        return null;
    };

    const parseTimeValue = (value) => {
        if (!value) {
            return null;
        }
        const normalized = value.length === 5 ? `${value}:00` : value;
        const parsed = new Date(`1970-01-01T${normalized}Z`);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
        return null;
    };

    const formatFestivalDay = (dayNumber, date) => {
        const parsedDate = parseDateValue(date);
        const dateText = parsedDate ? dayFormatter.format(parsedDate) : (date || "");
        if (dayNumber && dateText) {
            return `Day ${dayNumber} (${dateText})`;
        }
        if (dayNumber) {
            return `Day ${dayNumber}`;
        }
        return dateText;
    };

    return {
        formatGenre(value) {
            if (!value) {
                return "";
            }
            if (Array.isArray(value)) {
                return value.map(renderGenre).filter(Boolean).join(", ");
            }
            return renderGenre(value);
        },

        formatDate(value) {
            if (!value) {
                return "";
            }
            try {
                const parsed = parseDateValue(value);
                if (!parsed) {
                    return value;
                }
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

        formatPerformanceSlot(dayLabel, startTime, endTime, date) {
            if (!dayLabel && !startTime && !endTime && !date) {
                return "";
            }
            try {
                const dayText = dayLabel || formatFestivalDay(undefined, date);
                const start = parseTimeValue(startTime);
                const end = parseTimeValue(endTime);
                const startText = start ? timeFormatter.format(start) : "";
                const endText = end ? timeFormatter.format(end) : "";
                if (dayText && startText && endText) {
                    return `${dayText}, ${startText} - ${endText}`;
                }
                if (startText && endText) {
                    return `${startText} - ${endText}`;
                }
                if (dayText && startText) {
                    return `${dayText}, ${startText}`;
                }
                return dayText || startText || endText;
            } catch (e) {
                return `${dayLabel || date || ""} ${startTime || ""} ${endTime || ""}`.trim();
            }
        },

        formatPerformanceLabel(stageName, dayLabel, startTime, endTime, date) {
            const slot = this.formatPerformanceSlot(dayLabel, startTime, endTime, date);
            if (stageName && slot) {
                return `${stageName} (${slot})`;
            }
            if (stageName) {
                return stageName;
            }
            return slot;
        },

        formatFestivalDay(dayNumber, date) {
            return formatFestivalDay(dayNumber, date);
        },

        toAvatarSrc(data, mimeType) {
            if (!data) {
                return "";
            }
            if (typeof data === "string") {
                if (data.startsWith("data:")) {
                    return data;
                }
                if (data.startsWith("http://") || data.startsWith("https://") || data.startsWith("//")) {
                    return data;
                }
                if (data.startsWith("/") && data.length < 200) {
                    return data;
                }
            }
            const safeMime = mimeType || "image/png";
            return `data:${safeMime};base64,${data}`;
        },

        formatInitials(name) {
            if (!name) {
                return "";
            }
            const initials = name.split(" ")
                .filter(Boolean)
                .map((word) => word.charAt(0))
                .join("")
                .substring(0, 2)
                .toUpperCase();
            return initials;
        }
    };
});
