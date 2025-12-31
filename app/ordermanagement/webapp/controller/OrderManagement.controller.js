sap.ui.define([
    "sap/ui/core/mvc/Controller",
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
    "sap/f/library",
    "ordermanagement/ordermanagement/model/formatter"
], (Controller, Filter, FilterOperator, Sorter, Popover, VBox, Select, Item, SegmentedButton, SegmentedButtonItem, Button, MultiComboBox, Text, fLibrary, formatter) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;
    const STATUS_OPTIONS = ["Draft", "Submitted", "Paid", "Cancelled"];
    const TYPE_OPTIONS = ["Ticket", "Merchandise", "FoodDrinks"];

    return Controller.extend("ordermanagement.ordermanagement.controller.OrderManagement", {
        formatter,

        onInit() {
            this._fcl = this.byId("fcl");
            this._list = this.byId("orderList");
            this._sortPopover = null;
            this._sortSelect = null;
            this._sortDirection = null;
            this._filterPopover = null;
            this._filterStatus = null;
            this._filterType = null;
            this._searchQuery = "";
            this._filterStatuses = [];
            this._filterTypes = [];
            this._sortState = { key: "", descending: false };
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
            this._sortSelect.addItem(new Item({ key: "date", text: "Order Date" }));

            this._sortDirection = new SegmentedButton({
                selectionChange: this._applySort.bind(this),
                items: [
                    new SegmentedButtonItem({ key: "asc", text: "Asc" }),
                    new SegmentedButtonItem({ key: "desc", text: "Desc" })
                ]
            });
            this._sortDirection.setSelectedKey("desc");
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
            const hasKey = !!key;
            this._sortDirection.setVisible(hasKey);
            this._sortDirection.setEnabled(hasKey);
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
            this._deferredOpen(this._filterPopover, event.getSource());
        },

        _createFilterPopover() {
            this._filterStatus = new MultiComboBox({
                width: "100%",
                selectionChange: this._onFilterSelectionChange.bind(this),
                placeholder: "Select status"
            });
            STATUS_OPTIONS.forEach((s) => {
                this._filterStatus.addItem(new Item({ key: s, text: s }));
            });

            this._filterType = new MultiComboBox({
                width: "100%",
                selectionChange: this._onFilterSelectionChange.bind(this),
                placeholder: "Select order type"
            });
            TYPE_OPTIONS.forEach((t) => {
                this._filterType.addItem(new Item({ key: t, text: t }));
            });

            const clearButton = new Button({
                text: "Clear Filters",
                press: () => {
                    this._filterStatus.removeAllSelectedItems();
                    this._filterType.removeAllSelectedItems();
                    this._filterStatuses = [];
                    this._filterTypes = [];
                    this._applyFilters();
                }
            });

            const content = new VBox({
                width: "16rem",
                items: [
                    new Text({ text: "Status" }),
                    this._filterStatus,
                    new Text({ text: "Order type" }),
                    this._filterType,
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
            this._filterStatuses = this._filterStatus.getSelectedKeys();
            this._filterTypes = this._filterType.getSelectedKeys();
            this._applyFilters();
        },

        _applyFilters() {
            const binding = this._list.getBinding("items");
            if (!binding) {
                return;
            }
            const filters = [];

            if (this._searchQuery) {
                const searchFilters = [
                    new Filter({
                        path: "customerFirstName",
                        operator: FilterOperator.Contains,
                        value1: this._searchQuery,
                        caseSensitive: false
                    }),
                    new Filter({
                        path: "customerLastName",
                        operator: FilterOperator.Contains,
                        value1: this._searchQuery,
                        caseSensitive: false
                    })
                ];
                filters.push(new Filter({ filters: searchFilters, and: false }));
            }

            if (this._filterStatuses.length > 0) {
                const statusFilters = this._filterStatuses.map((s) => new Filter("status", FilterOperator.EQ, s));
                filters.push(new Filter({ filters: statusFilters, and: false }));
            }

            if (this._filterTypes.length > 0) {
                const typeFilters = this._filterTypes.map((t) => new Filter("type", FilterOperator.EQ, t));
                filters.push(new Filter({ filters: typeFilters, and: false }));
            }

            binding.filter(filters);
        },

        onSelectOrder(event) {
            const listItem = event.getParameter("listItem");
            const context = listItem && listItem.getBindingContext();
            const detailView = this.byId("detailView");
            if (detailView && context) {
                detailView.setBindingContext(context);
            }
            if (this._fcl) {
                this._fcl.setLayout(LayoutType.TwoColumnsBeginExpanded);
            }
        },

        formatCustomerName(firstName, lastName) {
            return formatter.formatCustomerName(firstName, lastName);
        },

        formatStatusState(status) {
            return formatter.formatStatusState(status);
        },

        formatAmount(value) {
            return formatter.formatAmount(value);
        },

        formatOrderType(type) {
            return formatter.formatOrderType(type);
        },

        formatDate(value) {
            return formatter.formatDate(value);
        },

        _deferredOpen(popover, opener) {
            if (!popover || !opener) {
                return;
            }
            setTimeout(() => {
                if (popover.isOpen && popover.isOpen()) {
                    popover.close();
                }
                popover.openBy(opener);
            }, 0);
        }
    });
});
