sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/f/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/Popover",
    "sap/m/VBox",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/SegmentedButton",
    "sap/m/SegmentedButtonItem",
    "sap/m/Button",
    "sap/m/MultiComboBox",
    "sap/m/Text",
    "artistmanagement/model/formatter",
    "artistmanagement/controller/util/CreateArtist",
    "sap/m/Token"
], (Controller, JSONModel, fLibrary, Filter, FilterOperator, Sorter, Popover, VBox, Select, Item, SegmentedButton, SegmentedButtonItem, Button, MultiComboBox, Text, formatter, CreateArtist, Token) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;

    return Controller.extend("artistmanagement.controller.ArtistManagement", {
        formatter,

        onInit() {
            const detailModel = new JSONModel({
                name: "Select an artist",
                id: "",
                countryId: "",
                spotifyUrl: "",
                instagramHandle: "",
                biography: "",
                genres: [],
                country: "",
                avatar: null,
                avatarMimeType: "",
                popularityScore: 0,
                reviews: [],
                performances: []
            });
            this.getView().setModel(detailModel, "detail");
            const detailView = this.byId("detailView");
            if (detailView) {
                detailView.setModel(detailModel, "detail");
            }
            this._fcl = this.byId("fcl");
            this._list = this.byId("artistList");
            this._sortPopover = null;
            this._sortState = { key: "", descending: false };
            this._filterPopover = null;
            this._filterGenres = [];
            this._filterCountries = [];
            this._searchQuery = "";
            sap.ui.getCore().getEventBus().subscribe("artist", "updated", this._onArtistUpdated, this);
        },

        onSelectArtist(event) {
            const context = event.getParameter("listItem").getBindingContext();
            if (!context) {
                return;
            }
            const data = context.getObject();
            const artistId = data.ID || data.id;
            if (!artistId) {
                return;
            }
            this._currentArtistId = artistId;
            const detailModel = this.getView().getModel("detail");
            detailModel.setData({
                name: "Loading...",
                id: artistId,
                countryId: "",
                spotifyUrl: "",
                instagramHandle: "",
                biography: "",
                genres: [],
                country: "",
                avatar: data.avatar || null,
                avatarMimeType: data.avatarMimeType || "",
                popularityScore: data.popularityScore || 0,
                reviews: [],
                performances: []
            });

            const oDataModel = this.getView().getModel();
            const artistBinding = oDataModel.bindContext(`/Artists('${artistId}')`, undefined, {
                $select: "ID,name,spotifyUrl,instagramHandle,biography,genres,avatar,avatarMimeType,country_ID",
                $expand: "country($select=ID,name)"
            });
            artistBinding.requestObject().then((artist) => {
                if (!artist) {
                    return;
                }
                if (this._currentArtistId !== artistId) {
                    return;
                }
                detailModel.setData({
                    name: artist.name || "",
                    id: artist.ID || artist.id || artistId,
                    countryId: (artist.country && artist.country.ID) || artist.country_ID || "",
                    spotifyUrl: artist.spotifyUrl || "",
                    instagramHandle: artist.instagramHandle || "",
                    biography: artist.biography || "",
                    genres: artist.genres || [],
                    country: (artist.country && artist.country.name) || "",
                    avatar: artist.avatar || null,
                    avatarMimeType: artist.avatarMimeType || "",
                    popularityScore: detailModel.getProperty("/popularityScore") || 0,
                    reviews: [],
                    performances: []
                });
                this._loadReviews(artistId);
                this._loadPerformances(artistId);
            }).catch(() => {
                detailModel.setData({
                    name: "Unavailable",
                    id: artistId,
                    countryId: "",
                    spotifyUrl: "",
                    instagramHandle: "",
                    biography: "",
                    genres: [],
                    country: "",
                avatar: null,
                avatarMimeType: "",
                popularityScore: 0,
                    reviews: [],
                    performances: []
                });
            });
            this._fcl.setLayout(LayoutType.TwoColumnsBeginExpanded);
        },

        onSearch(event) {
            this._searchQuery = event.getParameter("query") || "";
            this._applyFilters();
        },

        onOpenSortPopover(event) {
            if (!this._sortPopover) {
                this._sortPopover = this._createSortPopover();
            }
            this._deferredOpen(this._sortPopover, event.getSource());
        },

        _createSortPopover() {
            this._sortSelect = new Select({
                width: "100%",
                change: this._applySort.bind(this)
            });
            this._sortSelect.addItem(new Item({ key: "", text: "No Sorting" }));
            this._sortSelect.addItem(new Item({ key: "genres", text: "Genre" }));
            this._sortSelect.addItem(new Item({ key: "country", text: "Country" }));
            this._sortSelect.addItem(new Item({ key: "popularityScore", text: "Popularity" }));

            this._sortDirection = new SegmentedButton({
                selectionChange: this._applySort.bind(this),
                items: [
                    new SegmentedButtonItem({ key: "asc", text: "Asc" }),
                    new SegmentedButtonItem({ key: "desc", text: "Desc" })
                ]
            });
            this._sortDirection.setSelectedKey("asc");
            this._sortDirection.setVisible(false);
            this._sortDirection.setEnabled(false);

            const content = new VBox({
                width: "16rem",
                items: [this._sortSelect, this._sortDirection]
            }).addStyleClass("sapUiSmallMargin");

            return new Popover({
                placement: "Bottom",
                showHeader: true,
                title: "Sort",
                content: [content]
            });
        },

        _applySort() {
            const binding = this._list.getBinding("items");
            if (!binding) {
                return;
            }
            const key = this._sortSelect.getSelectedKey();
            const descending = this._sortDirection.getSelectedKey() === "desc";
            const showDirection = !!key;
            this._sortDirection.setVisible(showDirection);
            this._sortDirection.setEnabled(showDirection);
            if (!key) {
                binding.sort([]);
                this._sortState = { key: "", descending: false };
                return;
            }
            this._sortState = { key, descending };
            binding.sort(new Sorter(key, descending));
        },

        onOpenFilterPopover(event) {
            if (!this._filterPopover) {
                this._filterPopover = this._createFilterPopover();
            }
            this._refreshCountryOptions();
            this._deferredOpen(this._filterPopover, event.getSource());
        },

        _createFilterPopover() {
            this._filterGenre = new MultiComboBox({
                width: "100%",
                selectionChange: this._onFilterSelectionChange.bind(this),
                placeholder: "Select genres"
            });
            CreateArtist.getGenreOptions().forEach((g) => {
                this._filterGenre.addItem(new Item({ key: g.key, text: g.text }));
            });

            this._filterCountry = new MultiComboBox({
                width: "100%",
                placeholder: "Select countries",
                selectionChange: this._onFilterSelectionChange.bind(this)
            });

            const clearButton = new Button({
                text: "Clear Filters",
                press: () => {
                    this._filterGenre.removeAllSelectedItems();
                    this._filterCountry.removeAllSelectedItems();
                    this._filterGenres = [];
                    this._filterCountries = [];
                    this._applyFilters();
                }
            });

            const content = new VBox({
                width: "16rem",
                items: [
                    new Text({ text: "Genres" }),
                    this._filterGenre,
                    new Text({ text: "Countries" }),
                    this._filterCountry,
                    clearButton
                ]
            }).addStyleClass("sapUiSmallMargin");

            const pop = new Popover({
                placement: "Bottom",
                showHeader: true,
                title: "Filter",
                content: [content]
            });
            this.getView().addDependent(pop);
            return pop;
        },

        _onFilterSelectionChange() {
            this._filterGenres = this._filterGenre.getSelectedKeys();
            this._filterCountries = this._filterCountry.getSelectedKeys();
            this._applyFilters();
        },

        _applyFilters() {
            const binding = this._list.getBinding("items");
            if (!binding) {
                return;
            }
            const filters = [];

            if (this._searchQuery) {
                filters.push(new Filter({
                    path: "name",
                    operator: FilterOperator.Contains,
                    value1: this._searchQuery,
                    caseSensitive: false
                }));
            }

            if (this._filterGenres.length > 0) {
                const genreFilters = this._filterGenres.map((g) => new Filter("genres", FilterOperator.Contains, g));
                filters.push(new Filter({ filters: genreFilters, and: false }));
            }

            if (this._filterCountries.length > 0) {
                const countryFilters = this._filterCountries.map((c) => new Filter("country", FilterOperator.EQ, c));
                filters.push(new Filter({ filters: countryFilters, and: false }));
            }

            binding.filter(filters);
        },

        _refreshCountryOptions() {
            this._filterCountry.removeAllItems();
            const binding = this._list.getBinding("items");
            if (!binding) {
                return;
            }
            const contexts = binding.getContexts();
            const names = new Set(contexts.map((ctx) => ctx.getProperty("country")).filter(Boolean));
            names.forEach((name) => {
                this._filterCountry.addItem(new Item({ key: name, text: name }));
            });
        },

        formatGenre(value) {
            return formatter.formatGenre(value);
        },

        onListUpdateFinished(event) {
            const items = event.getSource().getItems() || [];
            items.forEach((item) => {
                const genresBox = this._findGenresContainer(item);
                const ctx = item.getBindingContext();
                if (!genresBox || !ctx) {
                    return;
                }
                genresBox.removeAllItems();
                const data = ctx.getObject && ctx.getObject();
                const genres = (data && data.genres) || [];
                genres.forEach((g) => {
                    const text = this.formatGenre(g);
                    if (text) {
                        const token = new Token({ text, editable: false });
                        token.addStyleClass("sapUiTinyMarginEnd sapUiMicroMarginBottom");
                        genresBox.addItem(token);
                    }
                });
            });
        },

        _loadReviews(artistId) {
            const detailModel = this.getView().getModel("detail");
            detailModel.setProperty("/reviews", []);
            if (!artistId) {
                return;
            }
            const oDataModel = this.getView().getModel();
            const reviewsBinding = oDataModel.bindList("/Reviews", undefined, undefined, [
                new Filter("performance/artist/ID", FilterOperator.EQ, artistId)
            ], {
                $select: "ID,rating,date,comment,customerName"
            });
            reviewsBinding.requestContexts(0, 200).then((contexts) => {
                if (this._currentArtistId !== artistId) {
                    return;
                }
                const reviews = contexts.map((ctx) => {
                    const review = ctx.getObject();
                    return {
                        id: review.ID || review.id || "",
                        rating: review.rating,
                        comment: review.comment,
                        date: review.date,
                        customerName: review.customerName
                    };
                });
                reviews.sort((a, b) => {
                    const aDate = a.date ? new Date(a.date).getTime() : 0;
                    const bDate = b.date ? new Date(b.date).getTime() : 0;
                    return bDate - aDate;
                });
                detailModel.setProperty("/reviews", reviews);
            }).catch(() => {
                if (this._currentArtistId === artistId) {
                    detailModel.setProperty("/reviews", []);
                }
            });
        },

        _loadPerformances(artistId) {
            const detailModel = this.getView().getModel("detail");
            detailModel.setProperty("/performances", []);
            if (!artistId) {
                return;
            }
            const oDataModel = this.getView().getModel();
            const performancesBinding = oDataModel.bindList("/Performances", undefined, undefined, [
                new Filter("artist/ID", FilterOperator.EQ, artistId)
            ], {
                $select: "ID,startAt,endAt,stage_ID",
                $expand: "stage($select=ID,name)"
            });
            performancesBinding.requestContexts(0, 200).then((contexts) => {
                if (this._currentArtistId !== artistId) {
                    return;
                }
                const performances = contexts.map((ctx) => {
                    const perf = ctx.getObject();
                    return {
                        id: perf.ID || perf.id || "",
                        startAt: perf.startAt,
                        endAt: perf.endAt,
                        stageName: (perf.stage && perf.stage.name) || "",
                        stageId: perf.stage_ID || (perf.stage && perf.stage.ID) || ""
                    };
                });
                performances.sort((a, b) => {
                    const aDate = a.startAt ? new Date(a.startAt).getTime() : 0;
                    const bDate = b.startAt ? new Date(b.startAt).getTime() : 0;
                    return aDate - bDate;
                });
                detailModel.setProperty("/performances", performances);
            }).catch(() => {
                if (this._currentArtistId === artistId) {
                    detailModel.setProperty("/performances", []);
                }
            });
        },

        onOpenCreateArtist() {
            CreateArtist.openCreateArtist(this);
        },

        onCancelCreateArtist() {
            CreateArtist.cancelCreateArtist(this);
        },

        onWizardStepChange(event) {
            CreateArtist.handleWizardStepChange(this, event);
        },

        onWizardNavNext() {
            CreateArtist.wizardNavNext(this);
        },

        onWizardNavBack() {
            CreateArtist.wizardNavBack(this);
        },

        onAddPerformanceRow() {
            CreateArtist.addPerformanceRow(this);
        },

        onRemovePerformanceRow(event) {
            CreateArtist.removePerformanceRow(this, event);
        },

        onCreateArtist() {
            CreateArtist.createArtist(this);
        },
        onBasicFieldChange() {
            CreateArtist.basicFieldChange(this);
        },

        onPerformanceFieldChange() {
            CreateArtist.performanceFieldChange(this);
        },

        toAvatarSrc(data, mimeType) {
            return formatter.toAvatarSrc(data, mimeType);
        },

        formatInitials(name) {
            return formatter.formatInitials(name);
        },

        onAvatarSelected(event) {
            CreateArtist.handleAvatarSelected(this, event);
        },

        onAvatarClear() {
            CreateArtist.clearAvatar(this);
        },

        _deferredOpen(popover, opener) {
            if (!popover || !opener) {
                return;
            }
            // Delay to let the OverflowToolbar close its own popover before opening ours :P
            setTimeout(() => {
                if (popover.isOpen && popover.isOpen()) {
                    popover.close();
                }
                popover.openBy(opener);
            }, 0);
        },

        _findGenresContainer(listItem) {
            if (!listItem || !listItem.getContent) {
                return null;
            }
            const vbox = listItem.getContent()[0];
            if (!vbox || !vbox.getItems) {
                return null;
            }
            const mainHBox = vbox.getItems()[1];
            if (!mainHBox || !mainHBox.getItems) {
                return null;
            }
            const innerHBox = mainHBox.getItems()[1];
            if (!innerHBox || !innerHBox.getItems) {
                return null;
            }
            const rightVBox = innerHBox.getItems()[1];
            if (!rightVBox || !rightVBox.getItems) {
                return null;
            }
            const genreRow = rightVBox.getItems()[1];
            if (!genreRow || !genreRow.getItems) {
                return null;
            }
            return genreRow.getItems()[0] || null;
        },

        _onArtistUpdated(_channel, _event, data) {
            if (!data || !data.id) {
                return;
            }
            if (this._list && this._list.getBinding("items")) {
                this._list.getBinding("items").refresh();
            }
            if (this._currentArtistId === data.id) {
                this._reloadCurrentArtist();
            }
        },

        _reloadCurrentArtist() {
            const artistId = this._currentArtistId;
            if (!artistId) {
                return;
            }
            const detailModel = this.getView().getModel("detail");
            const oDataModel = this.getView().getModel();
            const artistBinding = oDataModel.bindContext(`/Artists('${artistId}')`, undefined, {
                $select: "ID,name,spotifyUrl,instagramHandle,biography,genres,avatar,avatarMimeType,country_ID",
                $expand: "country($select=ID,name)"
            });
            artistBinding.requestObject().then((artist) => {
                if (!artist || this._currentArtistId !== artistId) {
                    return;
                }
                detailModel.setData({
                    name: artist.name || "",
                    id: artist.ID || artist.id || artistId,
                    countryId: (artist.country && artist.country.ID) || artist.country_ID || "",
                    spotifyUrl: artist.spotifyUrl || "",
                    instagramHandle: artist.instagramHandle || "",
                    biography: artist.biography || "",
                    genres: artist.genres || [],
                    country: (artist.country && artist.country.name) || "",
                    avatar: artist.avatar || null,
                    avatarMimeType: artist.avatarMimeType || "",
                    popularityScore: detailModel.getProperty("/popularityScore") || 0,
                    reviews: detailModel.getProperty("/reviews") || [],
                    performances: detailModel.getProperty("/performances") || []
                });
            });
        }
    });
});
