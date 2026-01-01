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
    const TYPE_OPTIONS = ["Ticket", "Merchandise", "FoodDrinks"];

    return Controller.extend("ordermanagement.ordermanagement.controller.OrderManagement", {
        formatter,

        onInit() {
            this._fcl = this.byId("fcl");
            this._statusLists = {
                Draft: this.byId("listDraft"),
                Submitted: this.byId("listSubmitted"),
                Paid: this.byId("listPaid"),
                Cancelled: this.byId("listCancelled")
            };
            this._statusPanels = {
                Draft: this.byId("panelDraft"),
                Submitted: this.byId("panelSubmitted"),
                Paid: this.byId("panelPaid"),
                Cancelled: this.byId("panelCancelled")
            };
            this._sortPopover = null;
            this._sortSelect = null;
            this._sortDirection = null;
            this._filterPopover = null;
            this._filterType = null;
            this._searchQuery = "";
            this._filterTypes = [];
            this._sortState = { key: "", descending: false };
            this._applyFilters();
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
            const key = this._sortSelect.getSelectedKey();
            const descending = this._sortDirection.getSelectedKey() === "desc";
            const hasKey = !!key;
            this._sortDirection.setVisible(hasKey);
            this._sortDirection.setEnabled(hasKey);
            const sorters = [];
            if (key) {
                this._sortState = { key, descending };
                sorters.push(new Sorter(key, descending));
            } else {
                this._sortState = { key: "", descending: false };
            }
            this._forEachStatusList((status, list) => {
                const binding = list && list.getBinding("items");
                if (binding) {
                    binding.sort(sorters);
                }
            });
        },

        onOpenFilterPopover(event) {
            if (!this._filterPopover) {
                this._filterPopover = this._createFilterPopover();
            }
            this._deferredOpen(this._filterPopover, event.getSource());
        },

        _createFilterPopover() {
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
                    this._filterType.removeAllSelectedItems();
                    this._filterTypes = [];
                    this._applyFilters();
                }
            });

            const content = new VBox({
                width: "16rem",
                items: [
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
            this._filterTypes = this._filterType.getSelectedKeys();
            this._applyFilters();
        },

        _applyFilters() {
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

            if (this._filterTypes.length > 0) {
                const typeFilters = this._filterTypes.map((t) => new Filter("type", FilterOperator.EQ, t));
                filters.push(new Filter({ filters: typeFilters, and: false }));
            }

            this._forEachStatusList((status, list, panel) => {
                const binding = list && list.getBinding("items");
                if (!binding) {
                    if (list) {
                        list.attachEventOnce("updateFinished", () => {
                            this._applyFilters();
                        });
                    }
                    return;
                }
                const statusFilter = new Filter("status", FilterOperator.EQ, status);
                const finalFilters = [statusFilter].concat(filters);
                binding.filter(finalFilters);
            });
        },

        onSelectOrder(event) {
            const listItem = event.getParameter("listItem");
            const context = listItem && listItem.getBindingContext();
            const detailView = this.byId("detailView");
            if (detailView && context) {
                detailView.setBindingContext(context);
            }
            const sourceList = event.getSource();
            this._clearOtherSelections(sourceList);
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

        _forEachStatusList(callback) {
            Object.keys(this._statusLists || {}).forEach((status) => {
                callback(status, this._statusLists[status], this._statusPanels[status]);
            });
        },

        _clearOtherSelections(sourceList) {
            this._forEachStatusList((_status, list) => {
                if (list && list !== sourceList) {
                    list.removeSelections(true);
                }
            });
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
