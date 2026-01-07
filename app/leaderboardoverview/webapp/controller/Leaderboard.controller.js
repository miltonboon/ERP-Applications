sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Sorter",
    "leaderboardoverview/leaderboardoverview/model/formatter"
], (Controller, JSONModel, Sorter, formatter) => {
    "use strict";

    const toBase64 = (buffer) => {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i += 1) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

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

    return Controller.extend("leaderboardoverview.leaderboardoverview.controller.Leaderboard", {
        formatter,

        onInit() {
            const viewModel = new JSONModel({
                items: [],
                filteredItems: [],
                performances: [],
                filteredPerformances: [],
                genreOptions: [],
                artistOptions: [],
                selectedGenres: [],
                selectedArtist: "",
                mode: "artists",
                busy: true
            });
            this.getView().setModel(viewModel, "leaderboard");
            this._loadLeaderboard();
        },

        _loadLeaderboard() {
            this.getView().getModel("leaderboard").setProperty("/busy", true);
            Promise.all([
                this._loadArtists(),
                this._loadPerformances()
            ]).then(() => {
                this._applyGenreFilter();
            }).finally(() => {
                this.getView().getModel("leaderboard").setProperty("/busy", false);
            });
        },

        _loadArtists() {
            const oDataModel = this.getOwnerComponent().getModel();
            if (!oDataModel) {
                return Promise.resolve();
            }
            const binding = oDataModel.bindList("/ArtistLeaderboard", undefined, [
                new Sorter("averageRating", true),
                new Sorter("reviewCount", true),
                new Sorter("name", false)
            ], undefined, {
                $select: "ID,name,country,genres,avatar,avatarMimeType,averageRating,reviewCount,performanceCount"
            });

            return binding.requestContexts(0, Infinity).then((contexts) => {
                const data = contexts.map((ctx) => ctx.getObject());
                const ranked = data.map((item, index) => ({
                    ...item,
                    rank: index + 1
                }));
                return this._hydrateAvatars(ranked).then((items) => {
                    const model = this.getView().getModel("leaderboard");
                    model.setProperty("/items", items || []);
                    const genreOptions = this._buildGenreOptions(items);
                    const artistOptions = this._buildArtistOptions(items);
                    model.setProperty("/genreOptions", genreOptions);
                    model.setProperty("/artistOptions", artistOptions);
                    const optionKeys = new Set((genreOptions || []).map((o) => o.key));
                    const selected = (model.getProperty("/selectedGenres") || []).filter((g) => optionKeys.has(g));
                    model.setProperty("/selectedGenres", selected);
                    const artistOptionKeys = new Set((artistOptions || []).map((o) => o.key));
                    const selectedArtist = model.getProperty("/selectedArtist") || "";
                    model.setProperty("/selectedArtist", artistOptionKeys.has(selectedArtist) ? selectedArtist : "");
                });
            }).catch(() => {
                const model = this.getView().getModel("leaderboard");
                model.setProperty("/items", []);
                model.setProperty("/genreOptions", []);
                model.setProperty("/artistOptions", []);
                model.setProperty("/selectedArtist", "");
                model.setProperty("/filteredItems", []);
            });
        },

        _loadPerformances() {
            const oDataModel = this.getOwnerComponent().getModel();
            if (!oDataModel) {
                return Promise.resolve();
            }
            const binding = oDataModel.bindList("/PerformanceLeaderboard", undefined, [
                new Sorter("averageRating", true),
                new Sorter("reviewCount", true),
                new Sorter("artistName", false)
            ], undefined, {
                $select: "ID,artistId,artistName,genres,stageName,dayNumber,dayDate,startTime,endTime,averageRating,reviewCount"
            });

            return binding.requestContexts(0, Infinity).then((contexts) => {
                const data = contexts.map((ctx) => ctx.getObject());
                const ranked = data.map((item, index) => ({
                    ...item,
                    rank: index + 1
                }));
                const model = this.getView().getModel("leaderboard");
                model.setProperty("/performances", ranked || []);
            }).catch(() => {
                const model = this.getView().getModel("leaderboard");
                model.setProperty("/performances", []);
                model.setProperty("/filteredPerformances", []);
            });
        },

        _hydrateAvatars(items) {
            const tasks = (items || []).map((item) => this._fetchAvatar(item));
            return Promise.all(tasks);
        },

        _fetchAvatar(item) {
            if (!item || item.avatar) {
                return Promise.resolve(item);
            }
            const id = item.ID || item.id;
            if (!id) {
                return Promise.resolve(item);
            }
            const url = `/odata/v4/festival/Artists('${encodeURIComponent(id)}')/avatar/$value`;
            return fetch(url).then((response) => {
                if (!response.ok) {
                    return item;
                }
                const mime = response.headers.get("Content-Type") || item.avatarMimeType || "image/jpeg";
                return response.arrayBuffer().then((buffer) => ({
                    ...item,
                    avatar: `data:${mime};base64,${toBase64(buffer)}`,
                    avatarMimeType: mime
                }));
            }).catch(() => item);
        },

        _applyGenreFilter() {
            const model = this.getView().getModel("leaderboard");
            const selected = model.getProperty("/selectedGenres") || [];
            const selectedArtist = model.getProperty("/selectedArtist") || "";
            const all = model.getProperty("/items") || [];
            const perfAll = model.getProperty("/performances") || [];
            const filtered = (!selected.length ? all : all.filter((item) => {
                const genres = normalizeGenres(item.genres);
                return genres.some((g) => selected.includes(g));
            })).map((item, index) => ({
                ...item,
                rank: index + 1
            }));
            const useArtistFilter = !!selectedArtist;
            const useGenreFilter = !useArtistFilter && selected.length > 0;
            const filteredPerformances = (!useArtistFilter && !useGenreFilter ? perfAll : perfAll.filter((item) => {
                if (useArtistFilter) {
                    return item.artistId === selectedArtist;
                }
                const genres = normalizeGenres(item.genres);
                return genres.some((g) => selected.includes(g));
            })).map((item, index) => ({
                ...item,
                rank: index + 1
            }));
            model.setProperty("/filteredItems", filtered);
            model.setProperty("/filteredPerformances", filteredPerformances);
        },

        _buildGenreOptions(items) {
            const byKey = new Map();
            (items || []).forEach((item) => {
                normalizeGenres(item.genres).forEach((genre) => {
                    if (!byKey.has(genre)) {
                        byKey.set(genre, formatter.formatGenre(genre) || genre);
                    }
                });
            });
            return Array.from(byKey.entries())
                .map(([key, text]) => ({ key, text }))
                .sort((a, b) => a.text.localeCompare(b.text));
        },

        onGenreSelectionChange(event) {
            const keys = event.getSource().getSelectedKeys();
            const model = this.getView().getModel("leaderboard");
            model.setProperty("/selectedGenres", keys || []);
            model.setProperty("/selectedArtist", "");
            this._applyGenreFilter();
        },

        onArtistSelectionChange(event) {
            const key = event.getSource().getSelectedKey();
            const model = this.getView().getModel("leaderboard");
            model.setProperty("/selectedArtist", key || "");
            model.setProperty("/selectedGenres", []);
            this._applyGenreFilter();
        },

        formatReviewCount(value) {
            return formatter.formatReviewCount(value);
        },

        formatAverage(value) {
            return formatter.formatAverage(value);
        },

        toAvatarSrc(data, mimeType, id) {
            return formatter.toAvatarSrc(data, mimeType, id);
        },

        formatInitials(name) {
            return formatter.formatInitials(name);
        },

        formatGenresList(value) {
            return formatter.formatGenresList(value);
        },

        formatGenre(value) {
            return formatter.formatGenre(value);
        },

        formatPerformanceSlot(dayNumber, dayDate, startTime, endTime, stageName) {
            const dayPart = dayNumber ? `Day ${dayNumber}${dayDate ? ` (${dayDate})` : ""}` : (dayDate || "");
            const timePart = [startTime, endTime].filter(Boolean).map((t) => (t && t.length >= 5 ? t.substring(0, 5) : t)).join(" - ");
            return [dayPart, timePart].filter(Boolean).join(" | ");
        },

        formatPerformanceCount(value) {
            return formatter.formatPerformanceCount(value);
        },

        onModeChange(event) {
            const key = event.getSource().getSelectedKey();
            this.getView().getModel("leaderboard").setProperty("/mode", key || "artists");
        },

        _buildArtistOptions(items) {
            const byKey = new Map();
            (items || []).forEach((item) => {
                const id = item.ID || item.id;
                const name = item.name || "";
                if (id && name && !byKey.has(id)) {
                    byKey.set(id, name);
                }
            });
            return Array.from(byKey.entries())
                .map(([key, text]) => ({ key, text }))
                .sort((a, b) => a.text.localeCompare(b.text));
        }
    });
});
