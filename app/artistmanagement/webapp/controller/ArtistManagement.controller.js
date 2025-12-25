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
    "sap/m/Button"
], (Controller, JSONModel, fLibrary, Filter, FilterOperator, Sorter, Popover, VBox, Select, Item, SegmentedButton, SegmentedButtonItem, Button) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;

    return Controller.extend("artistmanagement.controller.ArtistManagement", {
        onInit() {
            const detailModel = new JSONModel({ name: "Select an artist", id: "", spotifyUrl: "", instagramHandle: "" });
            this.getView().setModel(detailModel, "detail");
            const detailView = this.byId("detailView");
            if (detailView) {
                detailView.setModel(detailModel, "detail");
            }
            this._fcl = this.byId("fcl");
            this._table = this.byId("artistTable");
            this._sortPopover = null;
            this._sortState = { key: "", descending: false };
        },

        onSelectArtist(event) {
            const context = event.getParameter("listItem").getBindingContext();
            if (!context) {
                return;
            }
            const data = context.getObject();
            const detailModel = this.getView().getModel("detail");
            detailModel.setData({
                name: data.name,
                id: data.ID || data.id || "",
                spotifyUrl: data.spotifyUrl || "",
                instagramHandle: data.instagramHandle || ""
            });
            this._fcl.setLayout(LayoutType.TwoColumnsMidExpanded);
        },

        onSearch(event) {
            const query = event.getParameter("query") || "";
            const binding = this._table.getBinding("items");
            if (!binding) {
                return;
            }
            if (!query) {
                binding.filter([]);
                return;
            }
            const filters = [
                new Filter({
                    path: "name",
                    operator: FilterOperator.Contains,
                    value1: query,
                    caseSensitive: false
                })
            ];
            binding.filter(filters);
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
            if (!key) {
                binding.sort([]);
                this._sortState = { key: "", descending: false };
                return;
            }
            this._sortState = { key, descending };
            binding.sort(new Sorter(key, descending));
        },

        formatGenre(value) {
            if (!value) {
                return "";
            }
            const map = {
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
            return map[value] || value;
        }
    });
});
