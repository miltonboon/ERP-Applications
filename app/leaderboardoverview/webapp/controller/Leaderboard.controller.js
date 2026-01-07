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
                genreOptions: [],
                selectedGenres: [],
                busy: true
            });
            this.getView().setModel(viewModel, "leaderboard");
            this._loadLeaderboard();
        },

        _loadLeaderboard() {
            const oDataModel = this.getOwnerComponent().getModel();
            if (!oDataModel) {
                this.getView().getModel("leaderboard").setProperty("/busy", false);
                return;
            }
            const binding = oDataModel.bindList("/Leaderboard", undefined, [
                new Sorter("averageRating", true),
                new Sorter("reviewCount", true),
                new Sorter("name", false)
            ], undefined, {
                $select: "ID,name,country,genres,avatar,avatarMimeType,averageRating,reviewCount"
            });

            binding.requestContexts(0, Infinity).then((contexts) => {
                const data = contexts.map((ctx) => ctx.getObject());
                const ranked = data.map((item, index) => ({
                    ...item,
                    rank: index + 1
                }));
                return this._hydrateAvatars(ranked).then((items) => {
                    const model = this.getView().getModel("leaderboard");
                    model.setProperty("/items", items || []);
                    const genreOptions = this._buildGenreOptions(items);
                    model.setProperty("/genreOptions", genreOptions);
                    const optionKeys = new Set((genreOptions || []).map((o) => o.key));
                    const selected = (model.getProperty("/selectedGenres") || []).filter((g) => optionKeys.has(g));
                    model.setProperty("/selectedGenres", selected);
                    this._applyGenreFilter();
                });
            }).catch(() => {
                const model = this.getView().getModel("leaderboard");
                model.setProperty("/items", []);
                model.setProperty("/genreOptions", []);
                model.setProperty("/filteredItems", []);
            }).finally(() => {
                this.getView().getModel("leaderboard").setProperty("/busy", false);
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
            const all = model.getProperty("/items") || [];
            if (!selected.length) {
                model.setProperty("/filteredItems", all);
                return;
            }
            const filtered = all.filter((item) => {
                const genres = normalizeGenres(item.genres);
                return genres.some((g) => selected.includes(g));
            });
            model.setProperty("/filteredItems", filtered);
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
            this.getView().getModel("leaderboard").setProperty("/selectedGenres", keys || []);
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
        }
    });
});
