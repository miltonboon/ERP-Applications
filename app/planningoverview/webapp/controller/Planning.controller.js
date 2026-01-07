sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/base/Log",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Avatar",
    "sap/m/ObjectIdentifier",
    "sap/m/Text",
    "sap/m/FlexBox",
    "sap/m/Token",
    "sap/m/PlanningCalendarLegend",
    "sap/ui/unified/CalendarLegendItem"
], (Controller, JSONModel, Log, Dialog, Button, VBox, HBox, Avatar, ObjectIdentifier, Text, FlexBox, Token, PlanningCalendarLegend, CalendarLegendItem) => {
    "use strict";

    const GENRE_TYPE_MAP = {
        HIPHOP: "Type01",
        RNB: "Type02",
        EDM: "Type03",
        POP: "Type04",
        ROCK: "Type05",
        TECHNO: "Type06",
        HOUSE: "Type07",
        JAZZ: "Type08",
        CLASSICAL: "Type09",
        INDIE: "Type10",
        METAL: "Type11",
        LATIN: "Type12",
        AFROBEATS: "Type13",
        FUNK: "Type14",
        FOLK: "Type15",
        BLUES: "Type16",
        COUNTRY: "Type17"
    };

    return Controller.extend("planningoverview.planningoverview.controller.Planning", {
        onInit() {
            const oViewModel = new JSONModel({
                busy: true,
                startDate: new Date(),
                intervalCount: 12,
                rows: [],
                visibleRows: [],
                days: [],
                selectedDayId: "",
                legendItems: []
            });

            this.getView().setModel(oViewModel, "calendar");
            this._loadCalendarData(oViewModel);
        },

        onExit() {
            if (this._legendDialog) {
                this._legendDialog.destroy();
                this._legendDialog = null;
            }
        },

        onAfterRendering() {
            const oCal = this.byId("festivalPlanning");
            if (oCal && oCal._getHeader) {
                oCal._getHeader().setVisible(false);
            }
        },

        async _loadCalendarData(oViewModel) {
            try {
                const [aFestivalDays, aPerformances] = await Promise.all([
                    this._fetchFestivalDays(),
                    this._fetchPerformances()
                ]);
                const { rows: aRows, days, legendItems } = this._buildCalendarRows(aPerformances, aFestivalDays);

                oViewModel.setProperty("/rows", aRows);
                oViewModel.setProperty("/days", days);
                oViewModel.setProperty("/legendItems", legendItems);
                const sSelectedDayId = days[0]?.id || "";
                oViewModel.setProperty("/selectedDayId", sSelectedDayId);
                this._applyDaySelection(sSelectedDayId, oViewModel);
            } catch (error) {
                Log.error("Failed to load festival planning data", error);
                oViewModel.setProperty("/rows", []);
            } finally {
                oViewModel.setProperty("/busy", false);
            }
        },

        async _fetchPerformances() {
            const oModel = this.getOwnerComponent().getModel();
            const sServiceUrl = ((oModel.getServiceUrl && oModel.getServiceUrl()) || oModel.sServiceUrl || "/odata/v4/festival/").replace(/\/?$/, "/");
            this._serviceUrl = sServiceUrl;
            const sUrl = `${sServiceUrl}Performances?$expand=stage($select=ID,name),day($select=ID,date,dayNumber),artist($select=ID,name,genres,avatar,avatarMimeType)&$orderby=day/date,startTime`;

            const oResponse = await fetch(sUrl);
            if (!oResponse.ok) {
                throw new Error(`Request failed: ${oResponse.status} ${oResponse.statusText}`);
            }

            const oData = await oResponse.json();
            return Array.isArray(oData.value) ? oData.value : [];
        },

        async _fetchFestivalDays() {
            const oModel = this.getOwnerComponent().getModel();
            const sServiceUrl = ((oModel.getServiceUrl && oModel.getServiceUrl()) || oModel.sServiceUrl || "/odata/v4/festival/").replace(/\/?$/, "/");
            const sUrl = `${sServiceUrl}FestivalDays?$orderby=dayNumber`;
            const oResponse = await fetch(sUrl);
            if (!oResponse.ok) {
                throw new Error(`Request failed: ${oResponse.status} ${oResponse.statusText}`);
            }
            const oData = await oResponse.json();
            return Array.isArray(oData.value) ? oData.value : [];
        },

        _buildCalendarRows(aPerformances, aFestivalDays) {
            const mStageRows = {};
            const mDays = {};
            const mLegend = {};

            (aFestivalDays || []).forEach((oDay) => {
                const sDayId = oDay.ID || oDay.id;
                if (!sDayId) {
                    return;
                }
                mDays[sDayId] = {
                    id: sDayId,
                    date: oDay.date,
                    dayNumber: oDay.dayNumber,
                    minStartMinutes: null,
                    maxEndMinutes: null
                };
            });

            aPerformances.forEach((oPerformance) => {
                const oStage = oPerformance.stage || {};
                const oDay = oPerformance.day || {};
                const oArtist = oPerformance.artist || {};
                const sDayId = oDay.ID || oDay.id;

                const oStartDate = this._combineDateTime(oDay.date, oPerformance.startTime);
                const oEndDate = this._combineDateTime(oDay.date, oPerformance.endTime);

                if (!oStartDate || !oEndDate || !oStage.ID || !sDayId) {
                    return;
                }

                if (!mDays[sDayId]) {
                    mDays[sDayId] = {
                        id: sDayId,
                        date: oDay.date,
                        dayNumber: oDay.dayNumber,
                        minStartMinutes: null,
                        maxEndMinutes: null
                    };
                }

                const iStartMinutes = this._getMinutesOfDay(oPerformance.startTime);
                const iEndMinutes = this._getMinutesOfDay(oPerformance.endTime);
                if (iStartMinutes !== null) {
                    mDays[sDayId].minStartMinutes = mDays[sDayId].minStartMinutes === null ? iStartMinutes : Math.min(mDays[sDayId].minStartMinutes, iStartMinutes);
                }
                if (iEndMinutes !== null) {
                    mDays[sDayId].maxEndMinutes = mDays[sDayId].maxEndMinutes === null ? iEndMinutes : Math.max(mDays[sDayId].maxEndMinutes, iEndMinutes);
                }

                const sStageId = oStage.ID;
                if (!mStageRows[sStageId]) {
                    mStageRows[sStageId] = {
                        title: oStage.name,
                        subtitle: "Stage",
                        appointments: []
                    };
                }

                const sAvatarSrc = this._toAvatarImage(oArtist);
                mStageRows[sStageId].appointments.push({
                    startDate: oStartDate,
                    endDate: oEndDate,
                    artistId: oArtist.ID || oArtist.id,
                    artist: oArtist.name,
                    timeRange: this._formatTimeRange(oPerformance.startTime, oPerformance.endTime, oStartDate, oEndDate),
                    type: this._getAppointmentTypeFromGenre(oArtist.genres, oDay.dayNumber),
                    icon: this._toAppointmentIcon(oArtist),
                    avatarSrc: sAvatarSrc,
                    stage: oStage.name,
                    genres: this._formatGenres(oArtist.genres),
                    genresList: Array.isArray(oArtist.genres) ? oArtist.genres : [],
                    dayLabel: this._getDayLabel(oDay),
                    dayId: sDayId
                });

                if (Array.isArray(oArtist.genres) && oArtist.genres.length) {
                    const sGenre = oArtist.genres[0];
                    const sType = this._getAppointmentTypeFromGenre(oArtist.genres, oDay.dayNumber);
                    const sLabel = this._formatGenre(sGenre);
                    if (sType && sLabel) {
                        mLegend[sType] = sLabel;
                    }
                }
            });

            const rows = Object.values(mStageRows)
                .map((oRow) => ({
                    ...oRow,
                    appointments: oRow.appointments.sort((a, b) => a.startDate - b.startDate)
                }))
                .sort((a, b) => a.title.localeCompare(b.title));

            const days = Object.values(mDays).map((oDayInfo) => {
                const hasTimes = oDayInfo.minStartMinutes !== null && oDayInfo.maxEndMinutes !== null;
                const iStartMinutes = hasTimes ? oDayInfo.minStartMinutes : 0;
                const iEndMinutes = hasTimes ? oDayInfo.maxEndMinutes : iStartMinutes + 60;
                const iStartHour = Math.max(0, Math.floor(iStartMinutes / 60));
                const iEndHour = Math.min(24, Math.ceil(iEndMinutes / 60));
                const intervalCount = Math.max(1, iEndHour - iStartHour);
                const oStartDate = new Date(oDayInfo.date || Date.now());
                oStartDate.setHours(iStartHour, 0, 0, 0);
                return {
                    id: oDayInfo.id,
                    label: this._getDayLabel(oDayInfo),
                    startDate: oStartDate,
                    intervalCount
                };
            }).sort((a, b) => (a.startDate || 0) - (b.startDate || 0));

            const legendItems = Object.entries(mLegend).map(([type, label]) => ({ type, label })).sort((a, b) => a.label.localeCompare(b.label));

            return { rows, days, legendItems };
        },

        _combineDateTime(sDate, sTime) {
            if (!sDate || !sTime) {
                return null;
            }

            const oDate = new Date(sDate);
            const [iHour, iMinutes, iSeconds] = sTime.split(":").map(Number);
            oDate.setHours(iHour || 0, iMinutes || 0, iSeconds || 0, 0);
            return oDate;
        },

        _getDayLabel(oDay) {
            if (oDay && oDay.dayNumber) {
                const sDate = this._formatDate(oDay.date);
                return sDate ? `Day ${oDay.dayNumber} (${sDate})` : `Day ${oDay.dayNumber}`;
            }

            return this._formatDate(oDay && oDay.date);
        },

        _getAppointmentType(iDayNumber) {
            switch (iDayNumber) {
            case 1:
                return "Type01";
            case 2:
                return "Type02";
            case 3:
                return "Type03";
            default:
                return "Type06";
            }
        },

        _getAppointmentTypeFromGenre(aGenres, iDayNumber) {
            if (Array.isArray(aGenres) && aGenres.length) {
                const genre = aGenres[0];
                if (GENRE_TYPE_MAP[genre]) {
                    return GENRE_TYPE_MAP[genre];
                }
            }
            return this._getAppointmentType(iDayNumber);
        },

        _getMinutesOfDay(sTime) {
            if (!sTime) {
                return null;
            }
            const [iHour, iMinutes] = sTime.split(":").map(Number);
            if (Number.isNaN(iHour) || Number.isNaN(iMinutes)) {
                return null;
            }
            return (iHour * 60) + iMinutes;
        },

        _formatTimeRange(sStartTime, sEndTime, oStartDate, oEndDate) {
            const sStart = this._formatHHMM(sStartTime, oStartDate);
            const sEnd = this._formatHHMM(sEndTime, oEndDate);
            return sStart && sEnd ? `${sStart} - ${sEnd}` : "";
        },

        _formatGenres(aGenres) {
            if (!Array.isArray(aGenres) || !aGenres.length) {
                return "";
            }
            return aGenres.map((g) => this._formatGenre(g)).filter(Boolean).join(", ");
        },

        _formatGenre(value) {
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
                FUNK: "Funk",
                FOLK: "Folk",
                BLUES: "Blues",
                COUNTRY: "Country"
            };
            return map[value] || value;
        },

        _formatDate(value) {
            if (!value) {
                return "";
            }
            const oDate = new Date(value);
            if (Number.isNaN(oDate.getTime())) {
                return value;
            }
            return oDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
        },

        _formatHHMM(sTime, oDate) {
            if (sTime && typeof sTime === "string" && sTime.includes(":")) {
                return sTime.slice(0, 5);
            }
            if (oDate instanceof Date && !Number.isNaN(oDate.getTime())) {
                return oDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
            }
            return "";
        },

        _toAvatarImage(oArtist) {
            if (!oArtist) {
                return "";
            }

            const data = oArtist.avatar;
            const mimeType = (oArtist["avatar@odata.mediaContentType"] || oArtist.avatarMimeType) || "image/png";
            const mediaReadLink = oArtist["avatar@odata.mediaReadLink"];
            const sId = oArtist.ID || oArtist.id;

            const hasMedia = Boolean(mediaReadLink) || Boolean(data) || Boolean(oArtist.avatarMimeType);

            if (mediaReadLink && hasMedia) {
                return this._toAbsoluteUrl(mediaReadLink);
            }

            if (sId && hasMedia) {
                return `${this._serviceUrl}Artists('${sId}')/avatar/$value`;
            }

            if (!data) {
                return "";
            }
            if (typeof data === "string") {
                if (data.startsWith("data:")) {
                    return data;
                }
                if (data.startsWith("http://") || data.startsWith("https://") || data.startsWith("//")) {
                    return data;
                }
                if (data.startsWith("/") && data.length < 200) {
                    return data;
                }
            }
            const safeMime = mimeType || "image/png";
            return `data:${safeMime};base64,${data}`;
        },

        _toAppointmentIcon(oArtist) {
            const sImage = this._toAvatarImage(oArtist);
            return sImage || "sap-icon://employee";
        },

        _toAbsoluteUrl(path) {
            if (!path) {
                return "";
            }
            if (/^https?:\/\//i.test(path)) {
                return path;
            }
            if (path.startsWith("/")) {
                return path;
            }
            const base = this._serviceUrl || "";
            return `${base}${path}`;
        },

        _applyDaySelection(sDayId, oViewModel) {
            const aRows = oViewModel.getProperty("/rows") || [];
            const aDays = oViewModel.getProperty("/days") || [];
            const oDay = aDays.find((d) => d.id === sDayId) || aDays[0];
            const sTargetDayId = oDay ? oDay.id : "";

            const aVisibleRows = aRows
                .map((oRow) => {
                    const aApps = (oRow.appointments || []).filter((oApp) => oApp.dayId === sTargetDayId);
                    if (!aApps.length) {
                        return null;
                    }
                    return { ...oRow, appointments: aApps };
                })
                .filter(Boolean);

            oViewModel.setProperty("/visibleRows", aVisibleRows);
            oViewModel.setProperty("/startDate", oDay ? oDay.startDate : new Date());
            oViewModel.setProperty("/intervalCount", oDay ? oDay.intervalCount : 12);
        },

        _buildGenreTokens(aGenres) {
            if (!Array.isArray(aGenres) || !aGenres.length) {
                return [];
            }
            return aGenres.map((g) => {
                const text = this._formatGenre(g);
                return new Token({
                    text,
                    editable: false
                }).addStyleClass("sapUiTinyMarginEnd sapUiMicroMarginBottom");
            });
        },

        onOpenLegend() {
            if (!this._legendDialog) {
                const oLegend = new PlanningCalendarLegend({
                    appointmentItems: {
                        path: "calendar>/legendItems",
                        template: new CalendarLegendItem({
                            text: "{calendar>label}",
                            type: "{calendar>type}"
                        })
                    },
                    title: "Performances"
                });
                oLegend.setModel(this.getView().getModel("calendar"), "calendar");

                this._legendDialog = new Dialog({
                    title: "Color key",
                    contentWidth: "20rem",
                    content: [oLegend],
                    beginButton: new Button({
                        text: "Close",
                        press: () => {
                            this._legendDialog.close();
                        }
                    }),
                    afterClose: () => {
                        oLegend.destroy();
                        this._legendDialog.destroy();
                        this._legendDialog = null;
                    }
                });
            }

            this._legendDialog.open();
        },

        onDaySelection(oEvent) {
            const sKey = oEvent.getParameter("item").getKey();
            const oViewModel = this.getView().getModel("calendar");
            oViewModel.setProperty("/selectedDayId", sKey);
            this._applyDaySelection(sKey, oViewModel);
        },

        onAppointmentSelect(oEvent) {
            const oAppointment = oEvent.getParameter("appointment");
            if (!oAppointment) {
                return;
            }
            const oCtx = oAppointment.getBindingContext("calendar");
            if (!oCtx) {
                return;
            }
            const oData = oCtx.getObject() || {};

            const oDialog = new Dialog({
                title: oData.artist || "Performance",
                contentWidth: "24rem",
                content: [
                    new VBox({
                        width: "100%",
                        items: [
                            new HBox({
                                alignItems: "Center",
                                items: [
                                    new Avatar({
                                        displayShape: "Circle",
                                        displaySize: "M",
                                        src: oData.avatarSrc || "",
                                        fallbackIcon: "sap-icon://employee",
                                        initials: (oData.artist || "").slice(0, 2).toUpperCase()
                                    }),
                                    new VBox({
                                        width: "100%",
                                        items: [
                                            new ObjectIdentifier({
                                                title: oData.artist || "",
                                            }),
                                            new FlexBox({
                                                wrap: "Wrap",
                                                alignItems: "Center",
                                                items: this._buildGenreTokens(oData.genresList || [])
                                            }),
                                            new Text({ text: oData.stage || "" }),
                                            new Text({ text: oData.dayLabel || "" }),
                                            new Text({ text: oData.timeRange || "" })
                                        ]
                                    }).addStyleClass("sapUiSmallMarginBegin")
                                ]
                            })
                        ]
                    }).addStyleClass("sapUiSmallMargin sapUiSmallMarginBottom")
                ],
                beginButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.addStyleClass("sapUiContentPadding");
            oDialog.open();
        }
    });
});
