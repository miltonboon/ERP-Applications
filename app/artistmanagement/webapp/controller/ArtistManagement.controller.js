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
    "artistmanagement/model/formatter"
], (Controller, JSONModel, fLibrary, Filter, FilterOperator, Sorter, Popover, VBox, Select, Item, SegmentedButton, SegmentedButtonItem, Button, MultiComboBox, Text, formatter) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;

    return Controller.extend("artistmanagement.controller.ArtistManagement", {
        formatter,

        onInit() {
            const detailModel = new JSONModel({
                name: "Select an artist",
                id: "",
                spotifyUrl: "",
                instagramHandle: "",
                biography: "",
                genre: "",
                country: "",
                reviews: []
            });
            this.getView().setModel(detailModel, "detail");
            const detailView = this.byId("detailView");
            if (detailView) {
                detailView.setModel(detailModel, "detail");
            }
            this._fcl = this.byId("fcl");
            this._table = this.byId("artistTable");
            this._sortPopover = null;
            this._sortState = { key: "", descending: false };
            this._filterPopover = null;
            this._filterGenres = [];
            this._filterCountries = [];
            this._searchQuery = "";
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
                spotifyUrl: "",
                instagramHandle: "",
                biography: "",
                genre: "",
                country: "",
                reviews: []
            });

            const oDataModel = this.getView().getModel();
            const artistBinding = oDataModel.bindContext(`/Artists('${artistId}')`, undefined, {
                $select: "ID,name,spotifyUrl,instagramHandle,biography,genre",
                $expand: "country($select=name)"
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
                    spotifyUrl: artist.spotifyUrl || "",
                    instagramHandle: artist.instagramHandle || "",
                    biography: artist.biography || "",
                    genre: artist.genre || "",
                    country: (artist.country && artist.country.name) || "",
                    reviews: []
                });
                this._loadReviews(artistId);
            }).catch(() => {
                detailModel.setData({
                    name: "Unavailable",
                    id: artistId,
                    spotifyUrl: "",
                    instagramHandle: "",
                    biography: "",
                    genre: "",
                    country: "",
                    reviews: []
                });
            });
            this._fcl.setLayout(LayoutType.TwoColumnsMidExpanded);
        },

        onSearch(event) {
            this._searchQuery = event.getParameter("query") || "";
            this._applyFilters();
        },

        onOpenSortPopover(event) {
            if (!this._sortPopover) {
                this._sortPopover = this._createSortPopover();
            }
            this._sortPopover.openBy(event.getSource());
        },

        _createSortPopover() {
            this._sortSelect = new Select({
                width: "100%",
                change: this._applySort.bind(this)
            });
            this._sortSelect.addItem(new Item({ key: "", text: "No Sorting" }));
            this._sortSelect.addItem(new Item({ key: "genre", text: "Genre" }));
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
            const binding = this._table.getBinding("items");
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
            this._filterPopover.openBy(event.getSource());
        },

        _createFilterPopover() {
            this._filterGenre = new MultiComboBox({
                width: "100%",
                selectionChange: this._onFilterSelectionChange.bind(this),
                placeholder: "Select genres"
            });
            const genres = ["POP", "ROCK", "HIPHOP", "EDM", "TECHNO", "HOUSE", "JAZZ", "CLASSICAL", "RNB", "INDIE", "METAL", "LATIN", "AFROBEATS"];
            genres.forEach((g) => {
                this._filterGenre.addItem(new Item({ key: g, text: this.formatGenre(g) }));
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
            const binding = this._table.getBinding("items");
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
                const genreFilters = this._filterGenres.map((g) => new Filter("genre", FilterOperator.EQ, g));
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
            const binding = this._table.getBinding("items");
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
        }
    });
});
