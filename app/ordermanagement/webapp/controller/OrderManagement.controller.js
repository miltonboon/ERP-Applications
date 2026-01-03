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
    "sap/ui/model/json/JSONModel",
    "ordermanagement/ordermanagement/model/formatter",
    "ordermanagement/ordermanagement/controller/util/CreateOrder"
], (Controller, Filter, FilterOperator, Sorter, Popover, VBox, Select, Item, SegmentedButton, SegmentedButtonItem, Button, MultiComboBox, Text, fLibrary, JSONModel, formatter, CreateOrder) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;
    const TYPE_OPTIONS = ["Ticket", "Merchandise", "FoodDrinks"];

    return Controller.extend("ordermanagement.ordermanagement.controller.OrderManagement", {
        formatter,

        onInit() {
            this._fcl = this.byId("fcl");
            this._statusLists = {
                Submitted: this.byId("listSubmitted"),
                Paid: this.byId("listPaid"),
                Cancelled: this.byId("listCancelled")
            };
            this._statusPanels = {
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
            this._createOrder = new CreateOrder(this, TYPE_OPTIONS);
            this._applyFilters();
            this._applySort();
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
            this._sortSelect.addItem(new Item({ key: "date", text: "Order Date" }));
            this._sortSelect.setSelectedKey("date");

            this._sortDirection = new SegmentedButton({
                selectionChange: this._applySort.bind(this),
                items: [
                    new SegmentedButtonItem({ key: "asc", text: "Asc" }),
                    new SegmentedButtonItem({ key: "desc", text: "Desc" })
                ]
            });
            this._sortDirection.setSelectedKey("desc");
            this._sortDirection.setVisible(true);
            this._sortDirection.setEnabled(true);

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
            const key = this._sortSelect ? this._sortSelect.getSelectedKey() : "date";
            const descending = this._sortDirection ? this._sortDirection.getSelectedKey() === "desc" : true;
            const finalKey = key || "date";
            const sorters = [new Sorter(finalKey, descending)];
            this._sortState = { key: finalKey, descending };
            this._forEachStatusList((status, list) => {
                const binding = list && list.getBinding("items");
                if (binding) {
                    binding.sort(sorters);
                } else if (list) {
                    list.attachEventOnce("updateFinished", () => {
                        this._applySort();
                    });
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
                const orderId = context.getProperty("ID");
                const overviewTotal = context.getProperty("totalAmount");
                const parsedOverviewTotal = typeof overviewTotal === "number" ? overviewTotal : parseFloat(overviewTotal);
                const overviewData = {
                    total: Number.isFinite(parsedOverviewTotal) ? parsedOverviewTotal : null,
                    firstName: context.getProperty("customerFirstName"),
                    lastName: context.getProperty("customerLastName"),
                    type: context.getProperty("type"),
                    status: context.getProperty("status"),
                    date: context.getProperty("date"),
                    id: orderId
                };
                const overviewModel = detailView.getModel("overview") || new JSONModel();
                overviewModel.setData(overviewData);
                detailView.setModel(overviewModel, "overview");
                if (orderId) {
                    detailView.bindElement({
                        path: this._buildOrderPath(orderId),
                        parameters: {
                            $expand: "customer($select=ID,firstName,lastName,email,phone,address,postalCode,country_ID;$expand=country($select=ID,name,code)),items($expand=item)"
                        }
                    });
                    const elementBinding = detailView.getElementBinding();
                    const boundContext = elementBinding && elementBinding.getBoundContext ? elementBinding.getBoundContext() : null;
                    if (boundContext && boundContext.requestObject) {
                        boundContext.requestObject().then((data) => {
                            const items = Array.isArray(data.items) ? data.items : [];
                            const computedTotal = items.reduce((sum, item) => {
                                const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity);
                                const price = typeof item.unitPrice === "number" ? item.unitPrice : parseFloat(item.unitPrice);
                                if (Number.isNaN(qty) || Number.isNaN(price)) {
                                    return sum;
                                }
                                return sum + (qty * price);
                            }, 0);
                            const merged = Object.assign({}, overviewData, {
                                firstName: (data.customer && data.customer.firstName) || overviewData.firstName,
                                lastName: (data.customer && data.customer.lastName) || overviewData.lastName,
                                type: data.type || overviewData.type,
                                status: data.status || overviewData.status,
                                date: data.date || overviewData.date,
                                total: Number.isFinite(computedTotal) ? computedTotal : overviewData.total
                            });
                            overviewModel.setData(merged);
                        }).catch(() => {
                            overviewModel.setData(overviewData);
                        });
                    }
                } else {
                    detailView.unbindElement();
                    overviewModel.setData({});
                }
            }
            const sourceList = event.getSource();
            this._clearOtherSelections(sourceList);
            if (this._fcl) {
                this._fcl.setLayout(LayoutType.TwoColumnsBeginExpanded);
            }
        },

        async onOpenCreateOrder() {
            return this._createOrder.open();
        },

        onCloseOrderWizard() {
            this._createOrder.close();
        },

        onCustomerModeChange(event) {
            this._createOrder.handleCustomerModeChange(event);
        },

        onNewCustomerChange() {
            this._createOrder.handleNewCustomerChange();
        },

        onCustomerSearch(event) {
            this._createOrder.handleCustomerSearch(event);
        },

        onSelectCustomer(event) {
            this._createOrder.handleSelectCustomer(event);
        },

        onOrderTypeChange(event) {
            this._createOrder.handleOrderTypeChange(event);
        },

        onOrderDateChange(event) {
            this._createOrder.handleOrderDateChange(event);
        },

        onItemQuantityChange(event) {
            this._createOrder.handleItemQuantityChange(event);
        },

        onContinueFromCustomer() {
            this._createOrder.continueFromCustomer();
        },

        onContinueFromType() {
            this._createOrder.continueFromType();
        },

        onContinueFromItems() {
            this._createOrder.continueFromItems();
        },

        async onConfirmOrder() {
            await this._createOrder.confirmOrder();
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

        calculateItemTotal(quantity, unitPrice) {
            return formatter.calculateItemTotal(quantity, unitPrice);
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

        _buildOrderPath(orderId) {
            return `/Orders('${orderId}')`;
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
