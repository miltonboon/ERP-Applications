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
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], (Controller, JSONModel, fLibrary, Filter, FilterOperator, Sorter, Popover, VBox, Select, Item, SegmentedButton, SegmentedButtonItem, Button, MultiComboBox, Text, formatter, Fragment, MessageToast, MessageBox) => {
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
                popularityScore: data.popularityScore || 0,
                reviews: [],
                performances: []
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
                    spotifyUrl: "",
                    instagramHandle: "",
                    biography: "",
                    genre: "",
                    country: "",
                    popularityScore: 0,
                    reviews: [],
                    performances: []
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
                $select: "ID,startAt,endAt",
                $expand: "stage($select=name)"
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
                        stageName: (perf.stage && perf.stage.name) || ""
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
            this._resetWizardState();
            this._loadCreateOptions();
            this._getCreateArtistDialog().then((dialog) => {
                dialog.open();
                this._syncWizardButtons();
                this._validateBasicInfo();
            });
        },

        onCancelCreateArtist() {
            this._getCreateArtistDialog().then((dialog) => dialog.close());
        },

        onWizardStepChange(event) {
            const wizard = event.getSource();
            const step = event.getParameter("step");
            const steps = this._getWizardSteps();
            const newIndex = steps.indexOf(step);
            if (newIndex === -1) {
                return;
            }
            const prevIndex = this._currentWizardStepIndex || 0;
            const basicStep = this.byId("basicInfoStep");
            const performancesStep = this.byId("performancesStep");
            const basicIndex = steps.indexOf(basicStep);
            const performanceIndex = steps.indexOf(performancesStep);

            if (newIndex > prevIndex && basicIndex > -1 && newIndex > basicIndex && !this._validateBasicInfo()) {
                MessageToast.show("Fill in the basic artist info.");
                wizard.goToStep(basicStep);
                return;
            }
            if (newIndex > prevIndex && performanceIndex > -1 && newIndex > performanceIndex && !this._validatePerformances()) {
                MessageToast.show("Fix the performance details before continuing.");
                wizard.goToStep(performancesStep);
                return;
            }
            this._currentWizardStepIndex = newIndex;
            this._syncWizardButtons();
        },

        onWizardNavNext() {
            const wizard = this.byId("createArtistWizard");
            if (!wizard) {
                return;
            }
            const currentStepId = wizard.getCurrentStep();
            const basicStepId = this.byId("basicInfoStep") && this.byId("basicInfoStep").getId();
            const performanceStepId = this.byId("performancesStep") && this.byId("performancesStep").getId();

            if (currentStepId === basicStepId && !this._validateBasicInfo()) {
                MessageToast.show("Fill in the required basic info first.");
                return;
            }
            if (currentStepId === performanceStepId && !this._validatePerformances()) {
                MessageToast.show("Fix the performance details before continuing.");
                return;
            }
            wizard.nextStep();
            this._syncWizardButtons();
        },

        onWizardNavBack() {
            const wizard = this.byId("createArtistWizard");
            if (!wizard) {
                return;
            }
            wizard.previousStep();
            this._syncWizardButtons();
        },

        onAddPerformanceRow() {
            const model = this._getCreateModel();
            const performances = model.getProperty("/form/performances") || [];
            performances.push(this._getEmptyPerformance());
            model.setProperty("/form/performances", performances);
            this._validatePerformances();
        },

        onRemovePerformanceRow(event) {
            const context = event.getSource().getBindingContext("createModel");
            if (!context) {
                return;
            }
            const performances = this._getCreateModel().getProperty("/form/performances") || [];
            if (performances.length <= 1) {
                MessageToast.show("Keep at least one performance slot.");
                return;
            }
            const path = context.getPath();
            const index = Number(path.split("/").pop());
            if (Number.isInteger(index) && index >= 0) {
                performances.splice(index, 1);
                this._getCreateModel().setProperty("/form/performances", performances);
                this._validatePerformances();
            }
        },

        onCreateArtist() {
            const wizard = this.byId("createArtistWizard");
            const validBasic = this._validateBasicInfo();
            const validPerformances = this._validatePerformances();
            if (!validBasic) {
                if (wizard) {
                    wizard.goToStep(this.byId("basicInfoStep"));
                    this._syncWizardButtons();
                }
                MessageToast.show("Fill in the basic artist info.");
                return;
            }
            if (!validPerformances) {
                if (wizard) {
                    wizard.goToStep(this.byId("performancesStep"));
                    this._syncWizardButtons();
                }
                return;
            }

            const payload = this._buildCreatePayload();
            const dialogPromise = this._getCreateArtistDialog();
            dialogPromise.then((dialog) => dialog.setBusy(true));

            const oDataModel = this.getView().getModel();
            const listBinding = oDataModel.bindList("/Artists");
            const context = listBinding.create(payload);
            context.created().then(() => context.requestObject()).then(() => {
                dialogPromise.then((dialog) => dialog.setBusy(false));
                dialogPromise.then((dialog) => dialog.close());
                this._resetWizardState();
                if (this._table && this._table.getBinding("items")) {
                    this._table.getBinding("items").refresh();
                }
                MessageToast.show("Artist created");
            }).catch((err) => {
                dialogPromise.then((dialog) => dialog.setBusy(false));
                MessageBox.error("Create failed. Please try again.");
                // eslint-disable-next-line no-console
                console.error("Create artist failed", err);
            });
        },

        _getCreateArtistDialog() {
            if (!this._createDialogPromise) {
                this._createDialogPromise = Fragment.load({
                    id: this.getView().getId(),
                    name: "artistmanagement.fragments.CreateArtistWizard",
                    controller: this
                }).then((dialog) => {
                    dialog.setModel(this._getCreateModel(), "createModel");
                    this.getView().addDependent(dialog);
                    return dialog;
                });
            }
            return this._createDialogPromise;
        },

        _getCreateModel() {
            if (!this._createModel) {
                this._createModel = new JSONModel(this._getDefaultCreateData());
            }
            return this._createModel;
        },

        _getDefaultCreateData() {
            const genres = this._getGenreOptions();
            return {
                form: {
                    name: "",
                    genre: "",
                    countryId: "",
                    biography: "",
                    spotifyUrl: "",
                    instagramHandle: "",
                    performances: [this._getEmptyPerformance()]
                },
                options: {
                    genres,
                    countries: [],
                    stages: []
                },
                errors: {
                    name: "",
                    genre: "",
                    countryId: ""
                }
            };
        },

        _getEmptyPerformance() {
            return {
                stageId: "",
                day: "",
                startTime: "",
                endTime: "",
                errors: {
                    stageId: "",
                    day: "",
                    startTime: "",
                    endTime: "",
                    timeRange: ""
                }
            };
        },

        _getGenreOptions() {
            const keys = ["POP", "ROCK", "HIPHOP", "EDM", "TECHNO", "HOUSE", "JAZZ", "CLASSICAL", "RNB", "INDIE", "METAL", "LATIN", "AFROBEATS", "FOLK", "BLUES", "FUNK", "COUNTRY"];
            const options = keys.map((key) => ({
                key,
                text: this.formatGenre(key)
            }));
            return options;
        },

        _loadCreateOptions() {
            this._loadCountryOptions();
            this._loadStageOptions();
        },

        _loadCountryOptions() {
            const oDataModel = this.getView().getModel();
            if (!oDataModel) {
                return;
            }
            const binding = oDataModel.bindList("/Countries", undefined, undefined, undefined, {
                $select: "ID,name"
            });
            binding.requestContexts(0, 200).then((contexts) => {
                const countries = contexts.map((ctx) => ({
                    key: ctx.getProperty("ID") || "",
                    text: ctx.getProperty("name") || ""
                }));
                this._getCreateModel().setProperty("/options/countries", countries);
            }).catch(() => {
                this._getCreateModel().setProperty("/options/countries", []);
            });
        },

        _loadStageOptions() {
            const oDataModel = this.getView().getModel();
            if (!oDataModel) {
                return;
            }
            const binding = oDataModel.bindList("/Stages", undefined, undefined, undefined, {
                $select: "ID,name"
            });
            binding.requestContexts(0, 200).then((contexts) => {
                const stages = contexts.map((ctx) => ({
                    key: ctx.getProperty("ID") || "",
                    text: ctx.getProperty("name") || ""
                }));
                this._getCreateModel().setProperty("/options/stages", stages);
            }).catch(() => {
                this._getCreateModel().setProperty("/options/stages", []);
            });
        },

        _resetWizardState() {
            const model = this._getCreateModel();
            model.setData(this._getDefaultCreateData());
            const wizard = this.byId("createArtistWizard");
            const firstStep = this.byId("basicInfoStep");
            this._currentWizardStepIndex = 0;
            if (wizard && firstStep) {
                wizard.discardProgress(firstStep);
                wizard.goToStep(firstStep);
                this._setStepValidated(firstStep, false);
                const biographyStep = this.byId("biographyStep");
                const socialStep = this.byId("socialStep");
                const performancesStep = this.byId("performancesStep");
                const avatarStep = this.byId("avatarStep");
                this._setStepValidated(biographyStep, true);
                this._setStepValidated(socialStep, true);
                this._setStepValidated(performancesStep, false);
                this._setStepValidated(avatarStep, false);
            }
            this._syncWizardButtons();
        },

        _syncWizardButtons() {
            const wizard = this.byId("createArtistWizard");
            const create = this.byId("wizardCreateButton");
            if (!wizard || !create) {
                return;
            }
            const firstStepId = this.byId("basicInfoStep") && this.byId("basicInfoStep").getId();
            const lastStepId = this.byId("avatarStep") && this.byId("avatarStep").getId();
            const currentStepId = wizard.getCurrentStep();
            const isLast = currentStepId === lastStepId;
            create.setVisible(true);
        },

        _validateBasicInfo() {
            const model = this._getCreateModel();
            const form = model.getProperty("/form") || {};
            const errors = {
                name: form.name ? "" : "Enter the artist name",
                genre: form.genre ? "" : "Select a genre",
                countryId: form.countryId ? "" : "Select a country"
            };
            model.setProperty("/errors", errors);
            this._setStepValidated(this.byId("basicInfoStep"), !errors.name && !errors.genre && !errors.countryId);
            return !errors.name && !errors.genre && !errors.countryId;
        },

        _validatePerformances() {
            const model = this._getCreateModel();
            const performances = model.getProperty("/form/performances") || [];
            let valid = performances.length > 0;
            performances.forEach((perf, index) => {
                const errors = {
                    stageId: perf.stageId ? "" : "Choose a stage",
                    day: perf.day ? "" : "Select a day",
                    startTime: perf.startTime ? "" : "Select a start time",
                    endTime: perf.endTime ? "" : "Select an end time",
                    timeRange: ""
                };
                if (perf.day && perf.startTime && perf.endTime) {
                    const start = this._combineDateAndTime(perf.day, perf.startTime);
                    const end = this._combineDateAndTime(perf.day, perf.endTime);
                    if (start >= end) {
                        errors.timeRange = "End time must be after start time";
                    }
                }
                if (errors.stageId || errors.day || errors.startTime || errors.endTime || errors.timeRange) {
                    valid = false;
                }
                model.setProperty(`/form/performances/${index}/errors`, errors);
            });
            if (performances.length === 0) {
                MessageToast.show("Add at least one performance slot.");
            }
            this._setStepValidated(this.byId("performancesStep"), valid);
            return valid;
        },

        _combineDateAndTime(day, time) {
            const [year, month, date] = day.split("-").map(Number);
            const [hours, minutes] = time.split(":").map(Number);
            return new Date(Date.UTC(year, month - 1, date, hours || 0, minutes || 0));
        },

        _buildCreatePayload() {
            const form = this._getCreateModel().getProperty("/form") || {};
            const performances = (form.performances || []).map((perf) => {
                const startDate = this._combineDateAndTime(perf.day, perf.startTime);
                const endDate = this._combineDateAndTime(perf.day, perf.endTime);
                return {
                    startAt: startDate.toISOString(),
                    endAt: endDate.toISOString(),
                    stage_ID: perf.stageId
                };
            });
            return {
                name: form.name,
                genre: form.genre,
                biography: form.biography || "",
                spotifyUrl: form.spotifyUrl || "",
                instagramHandle: form.instagramHandle || "",
                country_ID: form.countryId,
                performances
            };
        },

        onBasicFieldChange() {
            this._validateBasicInfo();
            this._syncWizardButtons();
        },

        onPerformanceFieldChange() {
            this._validatePerformances();
            this._syncWizardButtons();
        },

        _getWizardSteps() {
            return [
                this.byId("basicInfoStep"),
                this.byId("biographyStep"),
                this.byId("socialStep"),
                this.byId("performancesStep"),
                this.byId("avatarStep")
            ].filter(Boolean);
        },

        _setStepValidated(step, isValid) {
            if (step && step.setValidated) {
                step.setValidated(!!isValid);
            }
        }
    });
});
