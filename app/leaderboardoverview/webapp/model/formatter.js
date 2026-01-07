sap.ui.define([], () => {
    "use strict";

    const GENRE_LABELS = {
        POP: "Pop",
        ROCK: "Rock",
        HIPHOP: "Hip Hop",
        EDM: "EDM",
        TECHNO: "Techno",
        HOUSE: "House",
        JAZZ: "Jazz",
        CLASSICAL: "Classical",
        RNB: "R&B",
        INDIE: "Indie",
        METAL: "Metal",
        LATIN: "Latin",
        AFROBEATS: "Afrobeats"
    };

    const toAvatarSrc = (data, mimeType, id) => {
        if (data) {
            if (typeof data === "string") {
                if (data.startsWith("data:") || data.startsWith("http://") || data.startsWith("https://") || data.startsWith("//")) {
                    return data;
                }
                if (data.startsWith("/") && data.length < 200) {
                    return data;
                }
            }
            const safeMime = mimeType || "image/png";
            return `data:${safeMime};base64,${data}`;
        }
        if (id) {
            const encodedId = encodeURIComponent(id);
            return `/odata/v4/festival/Artists('${encodedId}')/avatar/$value`;
        }
        return "";
    };

    const formatInitials = (name) => {
        if (!name) {
            return "";
        }
        return name.split(" ").filter(Boolean).map((word) => word.charAt(0)).join("").substring(0, 2).toUpperCase();
    };

    const formatAverage = (value) => {
        const number = Number(value);
        if (Number.isNaN(number)) {
            return "0.0";
        }
        return number.toFixed(1);
    };

    const formatReviewCount = (value) => {
        const count = Number(value) || 0;
        return count === 1 ? "1 review" : `${count} reviews`;
    };

    const formatGenre = (value) => GENRE_LABELS[value] || value || "";

    const formatGenresList = (value) => {
        const genres = normalizeGenres(value);
        if (!genres.length) {
            return "";
        }
        return genres.map((g) => formatGenre(g)).filter(Boolean).join(", ");
    };

    const getGenreOptions = () => Object.keys(GENRE_LABELS).map((key) => ({
        key,
        text: GENRE_LABELS[key] || key
    }));

    const normalizeGenres = (value) => {
        if (Array.isArray(value)) {
            return value;
        }
        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch (e) {
                return value.split(",").map((v) => v.trim()).filter(Boolean);
            }
        }
        return [];
    };

    return {
        toAvatarSrc,
        formatInitials,
        formatAverage,
        formatReviewCount,
        formatGenre,
        formatGenresList,
        normalizeGenres,
        getGenreOptions
    };
});
