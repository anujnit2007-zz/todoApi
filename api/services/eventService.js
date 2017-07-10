"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
const decorators_1 = require('nodedata/di/decorators');
const rfxExternalService_1 = require('./common/services/rfxExternalService');
const response_event_column_1 = require('../response.event.column');
const responsePricesheetColumnConstant_1 = require('../utils/constants/responsePricesheetColumnConstant');
const inject_1 = require('nodedata/di/decorators/inject');
const priceSheet_1 = require('../models/priceSheet');
const psevent_1 = require('../models/psevent');
const settings_1 = require('../models/settings');
const dataSheet_1 = require('../models/dataSheet');
const dataRow_1 = require('../models/dataRow');
const column_1 = require('../models/column');
const priceSheetRepository = require('../repositories/priceSheetRepository');
const dataRowRepository = require('../repositories/dataRowRepository');
const columnRepository = require('../repositories/columnRepository');
const dataSheetRepository = require('../repositories/dataSheetRepository');
const eventRepo = require('../repositories/eventRepository');
const sessionRepository_1 = require('../repositories/sessionRepository');
const request = require('./request');
var express = require("express");
const Enumerable = require('linq');
const Q = require('q');
var mongoose = require('mongoose');
const resources_1 = require('../utils/enums/resources');
const principalContext_1 = require('nodedata/security/auth/principalContext');
const security_config_1 = require('../security-config');
const priceSheetService = require('./PriceSheetService');
const commonConstants_1 = require('../utils/constants/commonConstants');
const utility = require('../utils/utilityFunctions');
const responsePricesheetColumnConstant_2 = require("../utils/constants/responsePricesheetColumnConstant");
const user_1 = require("../models/user");
//import { logger } from "../logging";
const messageBroker_interface_1 = require("./interfaces/messageBroker.interface");
const questionnaireRepository = require('../repositories/questionnaire/questionnaireRepository');
const R = require('ramda');
const guidelineRepository = require('../repositories/guideline/guidelineRepository');
const supplierAcceptance_1 = require('../models/guideline/supplierAcceptance');
const LoggerService = require("./common/services/LoggerService");
const guidelineService = require('../services/guideline/GuidelineService');
exports.customRoutes = express.Router();
let EventService = class EventService {
    constructor() {
        this.path = "/";
    }
    validateEventForPublish(eventId) {
        return this.eventRepository.findEventWithSheet(eventId).then((event) => {
            // 1. Check If the event actually exists.
            if (!event) {
                this.logger.logError(`[eventService.updatePublishStatus] : event not found : ${eventId}`);
                throw "no such event";
            }
            ;
            let isCBRValid = this.validateCBR(event);
            return isCBRValid.then(function (statusCBR) {
                // 2. Get the count of pricesheets and questionnaires;
                var isAttachmentForSupplierExists = statusCBR.status || statusCBR.errors.cbr[6] === '0';
                ;
                var sheetCnt = event.priceSheets ? event.priceSheets.length : 0;
                var questionnaireCnt = event.questionnaires ? event.questionnaires.length : 0;
                if (!sheetCnt && !questionnaireCnt && !isAttachmentForSupplierExists) {
                    this.logger.logError("No pricesheets, questionnaires or attachment for supplier found : " + eventId);
                    let errors = {};
                    errors.pricesheets = ["No pricesheets or questionnaires found for the event."];
                    return Q.resolve({ status: false, errors: errors });
                }
                if (!this.isAllQuestionnairesValid(event)) {
                    let errors = {};
                    errors.message = ['Questionnaires not valid for publish'];
                    return Q.resolve({ status: false, errors: errors });
                }
                // Check for drafting timeline.
                if (!event.getIsDraftingOpened()) {
                    console.log('[eventService.updatePublishStatus]', 'drafting time is over', eventId);
                    this.logger.logError("Drafting Time is over");
                    let errors = {};
                    errors.timeline = ["Drafting Time is over"];
                    return Q.resolve({ status: false, errors: errors });
                }
                // set Time-line values for pricesheets.
                //event.setTimeLineForPriceSheets();
                let currentUser = principalContext_1.PrincipalContext.User;
                console.log('[eventService.updatePublishStatus]', 'publish event', eventId, 'user id and name', currentUser.getUsername(), currentUser.userId);
                if (event.createdBy != currentUser.userId) {
                    let errors = {};
                    errors.message = ["You do not have rights to publish the event"];
                    return Q.resolve({ status: false, errors: errors });
                }
                if (event.isPublished && status) {
                    let errors = {};
                    errors.message = ["Event is already published"];
                    return Q.resolve({ status: false, errors: errors });
                }
                // Once we are at this point, it makes more sense to call the API publish and the .NET publish in parallel.
                var asyncCallsForPublish = [];
                var nodeApi = this.allSheetComplete(event).then(res => {
                    var errors = {};
                    if (!res.status) {
                        errors.pricesheets = res.errors;
                        return Q.resolve({ status: false, errors: errors });
                    }
                    else {
                        return Q.resolve({ status: true, errors: null });
                    }
                }).catch(err => {
                    this.logger.logError(`Error in checking all pricesheets : ${err}`);
                });
                // Check for validations from the .NET Code.
                // In order to do that, check if the URL is being set on the Server.
                asyncCallsForPublish.push(nodeApi);
                //asyncCallsForPublish.push(isCBRValid);
                Q.allSettled(asyncCallsForPublish).then(asyncCallsForPublishStatus => {
                    var fulfilledCnt = asyncCallsForPublishStatus.filter(s => s.state === "fulfilled");
                    if (fulfilledCnt.length !== asyncCallsForPublishStatus.length) {
                        var errors = {};
                        return Q.reject("Validation Failed");
                    }
                    return Q.resolve("Validation Success");
                })
                    .catch(err => {
                    this.logger.logError(`Error in validations for EventId : ${eventId}. Error : ${err}`);
                    return Q.reject(err);
                });
            });
        });
    }
    validateCBR(event) {
        let isCBRValid = Q.when();
        this.logger.logInfo("process.env.SOURCING_NET_URL" + process.env.SOURCING_NET_URL);
        if (process.env.SOURCING_NET_URL) {
            this.logger.logInfo(".NET URL Found");
            // Get the dd and the RequestVerificationCode
            let headers = principalContext_1.PrincipalContext.get("req").headers;
            this.logger.logInfo(JSON.stringify(headers));
            if (headers && headers.dd && headers.requestverificationtoken) {
                let dd = headers.dd;
                let reqVerificationCode = headers.requestverificationtoken;
                let documentCode = event.documentCode;
                let cookie = headers.cookie;
                let uri = process.env.SOURCING_NET_URL + "SourcingService/Integration/Validate?oloc=219&documentCode=" + documentCode;
                isCBRValid = request.Get(uri, { dd: dd, RequestVerificationToken: reqVerificationCode, Cookie: cookie });
                this.logger.logInfo("Calling .NET API for validate");
            }
        }
        return isCBRValid;
    }
    publishExternal(event, errors, asyncCalls) {
        return Q.allSettled(asyncCalls).then(suces => {
            if (process.env.SOURCING_NET_URL) {
                // Get the dd and the RequestVerificationCode
                return this._rfxExternalService.publishEvent(event).then(aa => {
                    return Q.resolve({ status: true, errors: errors });
                }).catch(err => {
                    this.logger.logError(`Error in Sending Publish Status to .NET ${err}`);
                    return Q.reject(err);
                });
            }
            return Q.resolve({ status: true, errors: errors });
        });
    }
    setDefaultSettings(event) {
        event.eventCurrency = event.eventCurrency ? event.eventCurrency : "USD";
        if (!event.eventSettings) {
            event.eventSettings = new settings_1.Settings();
            event.eventSettings.minScoreRange = 0;
            event.eventSettings.maxScoreRange = 4;
            event.eventSettings.priceScoring = true;
            event.eventSettings.priceScoringInstructions = 'pricesheet score in range';
            event.eventSettings.pricesheetWeightage = 50;
            event.eventSettings.questionnaireWeightage = 50;
            event.eventSettings.questionnaireInstructions = 'questionnaire score in range';
            event.eventSettings.questionnaire = true;
            event.eventSettings.skipScoring = true;
            event.eventSettings.multicurrency = false;
            event.eventSettings.sealed = false;
            event.eventSettings.scoringType = 'itemScoring';
            event.eventSettings.mandatoryguideline = false;
            event.eventSettings.eventPart = true;
        }
        if (!event.currencyList || event.currencyList.length == 0) {
            // add sample currency list
            event.currencyList = [];
        }
        var cur = Enumerable.from(event.currencyList).firstOrDefault(x => x.currencyName == event.eventCurrency);
        if (!cur) {
            event.currencyList.push({ currencyName: event.eventCurrency.toString(), currencyRate: 1 }); // will also the event currency conversion value
        }
    }
    /**
     * set publish = true for the selected event and all price sheets in it.
     * if already published, throw error
     * @param eventId
     * @param status
     */
    updatePublishStatus(eventId, status) {
        this.logger.logInfo("Publish Called for : " + eventId);
        return this.eventRepository.findEventWithSheet(eventId).then((event) => {
            if (!event) {
                this.logger.logError(`[eventService.updatePublishStatus] : event not found : ${eventId}`);
                throw "no such event";
            }
            ;
            let msg = event.publishValidationFailedMessage; // event.getPublishValidationMessage();
            let currentUser = principalContext_1.PrincipalContext.User;
            console.log('[eventService.updatePublishStatus]', 'publish event', eventId, 'user id and name', currentUser.getUsername(), currentUser.userId);
            if (event.createdBy != currentUser.userId)
                throw "no publish rights";
            if (event.isPublished && status) {
                throw "already published";
            }
            var errors = {};
            principalContext_1.PrincipalContext.User.viewContext = resources_1.PriceSheetViewContextEnum.SHEET_DB_CONTEXT;
            // Check for validations from the .NET Code.
            // In order to do that, check if the URL is being set on the Server.
            //todo
            this.logger.logInfo(`Calling validations for CBR`);
            return this._rfxExternalService.validateCBR(event).then(rr => {
                this.logger.logInfo("Recieved from .NET" + rr);
                console.log(rr);
                event.isCategoryExists = rr.status || rr.errors.cbr[0] === '0';
                event.isRegionExists = rr.status || rr.errors.cbr[1] === '0';
                event.isBUExists = rr.status || rr.errors.cbr[2] === '0';
                event.isDiverseSupplierExists = rr.status || rr.errors.cbr[4] === '0';
                event.isAttachmentForSupplierExists = rr.status || rr.errors.cbr[6] === '0';
                // Check for event validation for publish.
                if (!event.isValidForPublish()) {
                    let msg = event.getPublishValidationMessage();
                    this.logger.logError(`Error in event.isValidForPublish : ${msg}`);
                    let errorMesgs = msg.split(".");
                    errors.questionnaire = errorMesgs.filter(msVal => { return msVal != ""; });
                    return Q.resolve({ status: false, errors: errors });
                }
                this.logger.logInfo("event.isValidForPublish success");
                return this.allSheetComplete(event).then(res => {
                    var sheetIds = Enumerable.from(event.priceSheets).select((x) => {
                        return x._id.toHexString();
                    }).toArray();
                    if (!res.status) {
                        errors.pricesheets = res.errors;
                        return Q.resolve({ status: false, errors: errors });
                    }
                    this.setDefaultSettings(event);
                    event.totalQuestionaire = event.questionnaires && event.questionnaires.length;
                    event.setIsPublishedCascaded(status);
                    this.logger.logInfo("[eventService.updatePublishStatus] setIsPublishedCascaded called");
                    event.totalPriceSheets = event.priceSheets && event.priceSheets.length;
                    event.totalSuppliersInvited = event.suppliers && event.suppliers.length;
                    event.totalEvaluatorsInvited = (event.isPricesheetScoring() || event.isQuestionnaireScoring()) && event.teamMembers && event.teamMembers.allEvaluators && event.teamMembers.allEvaluators.length;
                    this.setSupplierGuidelineAcceptance(event);
                    return this.guidelineRepo.doGetMandatoryGuideline(eventId).then(mandatoryGuideline => {
                        event.totalMandatoryGuidelines = mandatoryGuideline ? mandatoryGuideline.length : 0;
                        var asyncCalls = [];
                        if (event.totalPriceSheets > 0 || event.totalQuestionaire > 0) {
                            return this.dataRowRepository.deleteUnfilledRows(event.priceSheets).then(suc => {
                                return this.eventRepository.fetchSheetsWithRowIds(sheetIds, event).then(finalResult => {
                                    return this._priceSheetService.getEventTotalBaseLineSpend(event.priceSheets, true).then(succes => {
                                        if (!isNaN(succes)) {
                                            event.totalBaselineSpend = succes;
                                        }
                                        else {
                                            event.totalBaselineSpend = undefined;
                                        }
                                        try {
                                            event.updateDraftingTimeline();
                                            this.logger.logInfo("[eventService.updatePublishStatus] Drafting Line Updated");
                                            this.createSupplierIntendToBidColumns(event);
                                            this.setAccessMaskForUserRolesAndCascade(event, false);
                                            this.setScoreRange(event);
                                            var updatedDataSheetArr = [];
                                            event.markAllSuppliersInvited(event.suppliers);
                                            this.setStatusAllSheets(event, status, updatedDataSheetArr);
                                            this.createSupplierIdColumnForPricesheets(event);
                                            this.createEvaluatorColumnForPricesheets(event);
                                            this.createRowsForSuppliers(event);
                                            this.createResponseColumnForEvent(event);
                                            this.createResponseSheetForEvent(event);
                                            this.createResponseColumnForPriceSheets(event);
                                            this.createResponseSheet(event);
                                            this.createAnalyzeViewColumns(event);
                                            event.setChildrenTimelines();
                                            // created for first time publishing
                                            currentUser[commonConstants_1.CommonConstants.caseFirstTimePublish] = true;
                                            Enumerable.from(event.priceSheets).forEach(sheet => {
                                                sheet.currencyList = event.currencyList;
                                                delete sheet.dataSheet;
                                            });
                                            return this.eventRepository.put(eventId, event).then(suces => {
                                                return this.guidelineRepo.bulkPut(event.guideLines).then(glSuccess => {
                                                    //return this.dataRowRepository.deleteUnfilledRows(event.priceSheets).then(suc => {
                                                    return this.priceSheetRepo.bulkPut(event.priceSheets).then(success => {
                                                        event.priceSheets.forEach((sheet) => {
                                                            delete sheet.dataSheet;
                                                            delete sheet.formatSheet;
                                                            asyncCalls.push(this.updatePublishData(sheet, updatedDataSheetArr));
                                                        });
                                                        //code for publishing a questionnaire
                                                        asyncCalls.push(this.publishQuestionnaire(event));
                                                        return this.publishExternal(event, errors, asyncCalls);
                                                    });
                                                });
                                                //})
                                            });
                                        }
                                        catch (err) {
                                            console.log('[eventService.updatePublishStatus]', 'publish event', eventId, 'error', err);
                                            throw err;
                                        }
                                    });
                                });
                            });
                        }
                        else {
                            return this.publishExternal(event, errors, asyncCalls);
                        }
                    });
                })
                    .catch(err => {
                    this.logger.logError(`.NET API calling failed : ${err}`);
                    return Q.reject(err);
                });
            });
        }).catch(error => {
            console.log('[eventService.updatePublishStatus]', 'eventId-', eventId, 'error', error);
            this.logger.logError(error);
            throw error;
        });
    }
    isAllQuestionnairesValid(event) {
        var isValid = true;
        Enumerable.from(event.questionnaires).forEach((questionnaire) => {
            if (!questionnaire.isValidForPublish()) {
                isValid = false;
            }
        });
        return isValid;
    }
    publishQuestionnaire(event) {
        var asyncCalls = [];
        if (event.questionnaires && event.questionnaires.length) {
            Enumerable.from(event.questionnaires).forEach((questionnaire) => {
                questionnaire.doPublished = true;
                delete questionnaire.guidelineSupplierAcceptance;
                delete questionnaire.currencyList;
                delete questionnaire.totalMandatoryGuidelines;
                asyncCalls.push(this.quesnnaireRepo.put(questionnaire._id, questionnaire));
            });
        }
        return Q.allSettled(asyncCalls).then(success => {
            return Q.resolve(success);
        }).catch(err => {
            return Q.reject(err);
        });
    }
    setRowCount(sheets) {
        sheets.forEach(sheet => {
            sheet.rowsCount = sheet.dataSheet.dataRows && sheet.dataSheet.dataRows.length;
        });
    }
    setSupplierGuidelineAcceptance(event) {
        Enumerable.from(event.suppliers).forEach(supplier => {
            let glAcceptanceSupplier = new supplierAcceptance_1.SupplierAcceptance();
            glAcceptanceSupplier.acceptanceStatus = false;
            glAcceptanceSupplier.userId = supplier.userId;
            glAcceptanceSupplier.userName = supplier.userName;
            glAcceptanceSupplier.numberOfGuidelineAccepted = 0;
            glAcceptanceSupplier.confirmParticipationStatus = false;
            event.guidelineSupplierAcceptance.push(glAcceptanceSupplier);
        });
    }
    updatePublishData(sheet, updatedDataSheetArr) {
        let updatedColms = Enumerable.from(sheet.colSchema).where((col) => {
            return col._id;
        }).toArray();
        return this.columnRepository.bulkPut(updatedColms).then(x => {
            var ids = Enumerable.from(updatedDataSheetArr).select(x => x._id).toArray();
            var mask = updatedDataSheetArr[0].usersAccessMask;
            return this.dataSheetRepository.bulkPutMany(ids, { 'usersAccessMask': mask }).then(success => {
                return success;
            });
        }).catch(error => {
            throw error;
        });
    }
    setScoreRange(event) {
        Enumerable.from(event.priceSheets).forEach((sheet) => {
            sheet.minScoringRange = event.eventSettings.minScoreRange;
            sheet.maxScoringRange = event.eventSettings.maxScoreRange;
        });
        Enumerable.from(event.questionnaires).forEach((questionnaire) => {
            questionnaire.minScoringRange = event.eventSettings.minScoreRange;
            questionnaire.maxScoringRange = event.eventSettings.maxScoreRange;
        });
    }
    getEventPriceSheetsSchema(eventId) {
        // remove transient properties from retunr objects - Mayank
        return this.priceSheetRepo.findWhere({ eventId: eventId }, ['name', 'createdByName', 'colSchema', 'sheetType']).then((sheets) => {
            sheets.forEach(sheet => {
                sheet.colSchema = Enumerable.from(sheet.colSchema).where((col) => !col.isResponseColumn).toArray();
            });
            return sheets;
        });
    }
    /**
  * get All event childrens (pricesheets, questionnaires, scorecards, scenarios etc)
  * @param id
  * @param event
  */
    getAsyncAllEventChildrens(id, event) {
        let asyncGetChildrens = [];
        //TODO : Event Repository eventLandingPageProperties - takes questionnaires in it, 
        //so event object is already loaded with questionnaires in it, do we want to call getAllEventQuestionnaires explicitly ?
        if (event.canReadEntityOnSettings()) {
            asyncGetChildrens.push(this.getAllEventPricesheets(id, event));
            asyncGetChildrens.push(this.getAllEventQuestionnaires(id, event));
        }
        else {
            event.priceSheets = [];
            event.questionnaires = [];
        }
        asyncGetChildrens.push(this.getAllEventGuidelines(id, event));
        return asyncGetChildrens;
    }
    getEventResponseData(eventId) {
        let currentUser = principalContext_1.PrincipalContext.User;
        var role = currentUser.getUserRole();
        //if (role != RoleEnum[RoleEnum.ROLE_AUTHOR]) {
        //    throw "not eligible to view response";
        //}
        console.log('eventService:[getEventResponseData]', 'event id:', eventId, 'user info', currentUser.getUsername(), currentUser.userId);
        return this.eventRepository.findOne(eventId).then((event) => {
            if (!event)
                throw "no such event";
            //event.responseDataSheet.dataRows = Enumerable.from(event.responseDataSheet.dataRows).where((dataRow: DataRow) => {
            //    return dataRow.isSupplierSubmitted && !dataRow.isAutoSum;
            //}).toArray(); 
            let viewers = event.teamMembers && event.teamMembers.allViewers.map(v => v.userId);
            if ((currentUser.userId != event.createdBy && viewers.indexOf(currentUser.userId) < 0) || !event.showResponseWorkbench())
                throw "not eligible to view response";
            var submittedSuppliers = Enumerable.from(event.suppliersSubmitted).select(x => x.userId).toArray();
            var responseColumns = event.responseColumnSchema;
            var responseSheet = event.responseDataSheet;
            var priceSheet = new priceSheet_1.PriceSheet();
            priceSheet.colSchema = responseColumns;
            if (currentUser.userInfoSessionObj && currentUser.userInfoSessionObj.selectedSuppliersMap) {
                var map = Enumerable.from(currentUser.userInfoSessionObj.selectedSuppliersMap).firstOrDefault(x => (x.eventId === eventId));
                if (map) {
                    var dataRows = responseSheet.dataRows;
                    var supplierIds = Enumerable.from(map.suppliers).select(x => x.userId).toArray();
                    let rowsToRetain = Enumerable.from(dataRows)
                        .where((row) => {
                        return row.s_id && (supplierIds.indexOf(row.s_id) >= 0);
                    }).toArray();
                    responseSheet.dataRows = rowsToRetain;
                }
            }
            responseSheet.dataRows = Enumerable.from(responseSheet.dataRows).where(x => submittedSuppliers.indexOf(x[commonConstants_1.CommonConstants.supplierId]) >= 0).toArray();
            priceSheet.dataSheet = responseSheet;
            priceSheet.accessMask = security_config_1.AccessMask.READ;
            var overAllPriceSheetScoreColIndex = null;
            var overAllQuestionnaireScoreColIndex = null;
            // remove SupplierId column in response summary view
            priceSheet.colSchema = Enumerable.from(priceSheet.colSchema)
                .where((col, index) => {
                if (col.name == responsePricesheetColumnConstant_1.ResponseEventConstant.OverallPriceSheetScore && !event.totalPriceSheets) {
                    overAllPriceSheetScoreColIndex = index;
                }
                if (col.name == responsePricesheetColumnConstant_1.ResponseEventConstant.OverallQuestionnaireScore && !event.totalQuestionaire) {
                    overAllQuestionnaireScoreColIndex = index;
                }
                return col.name !== responsePricesheetColumnConstant_1.ResponseEventConstant.SupplierId;
            })
                .toArray();
            if (overAllPriceSheetScoreColIndex != null) {
                priceSheet.colSchema.splice(overAllPriceSheetScoreColIndex, 1);
            }
            if (overAllQuestionnaireScoreColIndex != null) {
                priceSheet.colSchema.splice(overAllQuestionnaireScoreColIndex, 1);
            }
            if (event.scoringTimeLine && !utility.isTimelineNotEnded(event.scoringTimeLine)) {
                priceSheet.colSchema = Enumerable.from(priceSheet.colSchema)
                    .where((c) => (c.name != responsePricesheetColumnConstant_1.ResponseEventConstant.OverallQuestionnaireScore) && (c.name != responsePricesheetColumnConstant_1.ResponseEventConstant.EventScore))
                    .toArray();
            }
            var eventScore = Enumerable.from(priceSheet.colSchema).firstOrDefault(x => x.name == responsePricesheetColumnConstant_1.ResponseEventConstant.EventScore);
            if (eventScore) {
                eventScore.settings.formula = eventScore.settings.formula.replace(responsePricesheetColumnConstant_1.ResponseEventConstant.PricesheetWeightage, event.eventSettings.pricesheetWeightage.toString());
                eventScore.settings.formula = eventScore.settings.formula.replace(responsePricesheetColumnConstant_1.ResponseEventConstant.QuestionnaireWeightage, event.eventSettings.questionnaireWeightage.toString());
                eventScore.settings.formulaBuffer.forEach((x, index) => {
                    if (x == responsePricesheetColumnConstant_1.ResponseEventConstant.PricesheetWeightage) {
                        eventScore.settings.formulaBuffer[index] = event.eventSettings.pricesheetWeightage.toString();
                    }
                    else if (x == responsePricesheetColumnConstant_1.ResponseEventConstant.QuestionnaireWeightage) {
                        eventScore.settings.formulaBuffer[index] = event.eventSettings.questionnaireWeightage.toString();
                    }
                });
            }
            priceSheet.isResponseView = true;
            if (priceSheet.dataSheet && priceSheet.dataSheet.dataRows) {
                var supNameCol = Enumerable.from(priceSheet.colSchema).firstOrDefault(x => x.name == commonConstants_1.CommonConstants.SupplierNameColumnName);
                if (supNameCol) {
                    var supp = {};
                    event.suppliers.forEach(x => {
                        supp[x.userId] = x;
                    });
                    priceSheet.dataSheet.dataRows.forEach(x => {
                        x[supNameCol.virtualId] = supp[x[commonConstants_1.CommonConstants.supplierId]].legalCompanyName;
                    });
                }
            }
            return priceSheet;
        }).catch(error => {
            console.log('eventService:[getEventResponseData]', 'event id:', eventId, 'error', error, 'user info', currentUser.getUsername(), currentUser.userId);
            throw error;
        });
    }
    setAccessMaskForUserRolesAndCascade(event, cascade) {
        let userAccessMask = event.getReadOnlyAccessMaskForUserRolesEvent(true, true, true);
        if (cascade) {
            event.setUserAccessMask(userAccessMask);
            event.resetAllAuthorMask(security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_AUTHOR], security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ]);
        }
        else {
            event.setUsersAccessMaskWithoutCascade(userAccessMask);
            event.resetAllAuthorMAskWithoutCascade(security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_AUTHOR], security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ]);
        }
        event.questionnaires.forEach((questionnaire) => {
            let userAccessMaskQuestionnaire = questionnaire.getReadOnlyAccessMaskForUserRolesQuestionnaire(true, true, true);
            questionnaire.resetAllAuthorMask(security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_AUTHOR], security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ]);
            //  questionnaire.setUserAccessMaskTeamMember(userAccessMaskSheet,questionnaire);
            questionnaire.setUserAccessMask(userAccessMaskQuestionnaire);
        });
        event.priceSheets.forEach((sheet) => {
            let userAccessMaskSheet = sheet.getReadOnlyAccessMaskForUserRolesSheet(true, true, true);
            sheet.setUserAccessMask(userAccessMaskSheet);
            sheet.resetAllAuthorMask(security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_AUTHOR], security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ]);
            let suppliersColms = Enumerable.from(sheet.colSchema).where((col) => col.allowSupplierInput == true).toArray();
            suppliersColms.forEach((sCol) => {
                Enumerable.from(sheet.suppliers).forEach(sup => {
                    if (sup.currency) {
                        sCol.usersAccessMask[sup.userId] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READWRITE];
                    }
                });
            });
        });
        if (event.guideLines) {
            event.guideLines.forEach((guideline) => {
                let userAccessMaskGuideline = guideline.getReadOnlyAccessMaskForUserRolesGuideline(true, true);
                guideline.setUserAccessMask(userAccessMaskGuideline);
            });
        }
    }
    /**
     * create supplier id column which will have supplier id's for all rows.
     * @param event
     */
    createSupplierIdColumnForPricesheets(event) {
        event.priceSheets.forEach((sheet) => {
            this._priceSheetService.createSupplierIdColumn(sheet);
            var accessMask = sheet.getReadOnlyAccessMaskForUserRolesSheet(true, false, true);
            this._priceSheetService.createSupplierExchangeColumn(sheet, accessMask);
            this._priceSheetService.createSupplierCurrencyColumn(sheet, accessMask);
            this._priceSheetService.createSupplierNameColumn(sheet, accessMask);
        });
    }
    createSupplierIntendToBidColumns(event) {
        event.priceSheets.forEach(sheet => {
            this._priceSheetService.createSupplierIntendToBidColumn(sheet);
        });
    }
    createEvaluatorColumnForPricesheets(event) {
        event.priceSheets.forEach((sheet) => {
            let id = 1;
            Enumerable.from(sheet.evaluators).forEach(evaluator => {
                this._priceSheetService.createEvaluatorColumn(sheet, evaluator, `e${id}`, event.isItemLevelScoringEnabled());
                id++;
            });
        });
    }
    createAnalyzeViewColumns(event) {
        event.priceSheets.forEach(sheet => {
            this._priceSheetService.createAnalyzeViewColumn(sheet, responsePricesheetColumnConstant_2.DefaultPriceSheetColumnConstant.Savings);
            this._priceSheetService.createAnalyzeViewColumn(sheet, responsePricesheetColumnConstant_2.DefaultPriceSheetColumnConstant.SavingsPer);
        });
    }
    createRowsForSuppliers(event) {
        Enumerable.from(event.priceSheets).forEach((sheet) => {
            let orgRows = new Array();
            //let orgRows = sheet.dataSheet.dataRows;
            sheet.dataSheet.dataRows.forEach(row => {
                orgRows.push(row);
            });
            Enumerable.from(sheet.suppliers).forEach((supplier, index) => {
                if (supplier.currency) {
                    this._priceSheetService.createRowsForSuppliers(event, sheet, supplier, orgRows);
                }
            });
        });
    }
    createResponseSheet(event) {
        event.priceSheets.forEach((sheet) => {
            this.createColumnSchemaFromResponseJson(sheet);
            sheet.responseDataSheet = new dataSheet_1.DataSheet();
            sheet.responseDataSheet.dataRows = new Array();
            Enumerable.from(sheet.suppliers).forEach(supplier => {
                if (!supplier.currency)
                    return;
                let row = new dataRow_1.DataRow();
                row.s_id = supplier.userId;
                row.priceSheetId = sheet._id.toHexString();
                let virtualIdForSupplierId = Enumerable.from(sheet.responseColumnSchema)
                    .where(x => x.name == responsePricesheetColumnConstant_1.ResponsePriceSheetConstant.SupplierId)
                    .select(x => x.virtualId).firstOrDefault();
                row[virtualIdForSupplierId] = supplier.userId;
                let virtualIdForSupplierName = Enumerable.from(sheet.responseColumnSchema)
                    .where(x => x.name == responsePricesheetColumnConstant_1.ResponsePriceSheetConstant.SupplierName)
                    .select(x => x.virtualId).firstOrDefault();
                row[virtualIdForSupplierName] = supplier.legalCompanyName;
                let virtualIdForSheetCurrency = Enumerable.from(sheet.responseColumnSchema)
                    .where(x => x.name == responsePricesheetColumnConstant_1.ResponsePriceSheetConstant.PriceSheetCurrency)
                    .select(x => x.virtualId).firstOrDefault();
                row[virtualIdForSheetCurrency] = event.eventCurrency;
                sheet.responseDataSheet.dataRows.push(row);
            });
            let userAccessMask = {};
            event.evaluators.forEach(evaluator => {
                userAccessMask[evaluator.userId] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READWRITE];
            });
            sheet.responseDataSheet.setUserAccessMask(userAccessMask);
        });
    }
    createColumnSchemaFromResponseJson(sheet) {
        //sheet.responseColumnSchema = new Array<Column>();
        //read json create all columns
        //for each evaluators create my score column
        //create overall score column for buyer view
    }
    createResponseColumnForPriceSheets(event) {
        event.priceSheets.forEach((sheet) => {
            this._priceSheetService.createResponseColumnPSheet(sheet, event.eventCurrency);
        });
    }
    createResponseColumnForEvent(event) {
        event.responseColumnSchema = new Array();
        var responseColumns = response_event_column_1.EventResponseColumn.eventResponsejson;
        Enumerable.from(responseColumns).forEach((col) => {
            let resCol = new column_1.Column();
            resCol.setAttributes(col);
            if (col.type == "Currency") {
                resCol.settings['bindingCurrency'] = event.eventCurrency;
            }
            event.responseColumnSchema.push(resCol);
        });
    }
    createResponseSheetForEvent(event) {
        event.responseDataSheet = new dataSheet_1.DataSheet();
        event.responseDataSheet.dataRows = new Array();
        Enumerable.from(event.suppliers).forEach((supplier) => {
            let row = new dataRow_1.DataRow();
            let virtualIdForSupplierId = Enumerable.from(event.responseColumnSchema)
                .where(x => x.name == responsePricesheetColumnConstant_1.ResponseEventConstant.SupplierId)
                .select(x => x.virtualId).firstOrDefault();
            row[virtualIdForSupplierId] = supplier.userId;
            let virtualIdForSupplierName = Enumerable.from(event.responseColumnSchema)
                .where(x => x.name == responsePricesheetColumnConstant_1.ResponseEventConstant.SupplierName)
                .select(x => x.virtualId).firstOrDefault();
            row[virtualIdForSupplierName] = supplier.legalCompanyName;
            let virtualIdForEventCurrency = Enumerable.from(event.responseColumnSchema)
                .where(x => x.name == responsePricesheetColumnConstant_1.ResponseEventConstant.EventCurrency)
                .select(x => x.virtualId).firstOrDefault();
            row[virtualIdForEventCurrency] = event.eventCurrency;
            row[commonConstants_1.CommonConstants.supplierId] = supplier.userId;
            event.responseDataSheet.dataRows.push(row);
        });
        // only auther & co-authors can view response sheet in readonly mode
        var userAccessMask = {};
        let curUser = principalContext_1.PrincipalContext.User;
        userAccessMask[curUser.userId] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ];
        if (event.coAuthors) {
            event.coAuthors.forEach(id => {
                userAccessMask[+id] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ];
            });
        }
        event.evaluators.forEach(evalu => {
            userAccessMask[evalu.userId] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ];
        });
        event.responseDataSheet.setUserAccessMask(userAccessMask);
    }
    setStatusAllSheets(event, status, updatedDataSheetArr) {
        if (!event.teamMembers)
            event.teamMembers = {};
        event.priceSheets.forEach((sheet) => {
            // set status for supplier
            var userAccessMask = {};
            userAccessMask[event.createdBy] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ];
            if (!event.teamMembers)
                event.teamMembers = {};
            Enumerable.from(sheet.suppliers).forEach(sup => {
                if (sup.currency) {
                    userAccessMask[sup.userId] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ];
                }
            });
            Enumerable.from(event.teamMembers.allEvaluators).forEach(evaluatr => {
                userAccessMask[evaluatr.userId] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ];
            });
            sheet.supplier_status = {};
            sheet.supplier_status.user_status = {};
            sheet.supplier_status.final_status = resources_1.StatusEnum.INPROGRESS;
            Enumerable.from(sheet.suppliers).forEach(supplier => {
                if (supplier.currency) {
                    sheet.supplier_status.user_status[supplier.userId] = resources_1.StatusEnum.INPROGRESS;
                }
            });
            sheet.buyerDataSheets.forEach((buyerSheet) => {
                var dataSheet = { '_id': buyerSheet, 'usersAccessMask': userAccessMask };
                updatedDataSheetArr.push(dataSheet);
            });
            if (sheet.dataSheet && sheet.dataSheet._id) {
                let dataSheet = { '_id': sheet.dataSheet._id, 'usersAccessMask': userAccessMask };
                updatedDataSheetArr.push(dataSheet);
            }
            if (sheet.formatSheet && sheet.formatSheet._id) {
                let dataSheet = { '_id': sheet.formatSheet._id, 'usersAccessMask': userAccessMask };
                updatedDataSheetArr.push(dataSheet);
            }
            sheet.buyerFormatSheets.forEach((buyerSheet) => {
                var dataSheet = { '_id': buyerSheet, 'usersAccessMask': userAccessMask };
                updatedDataSheetArr.push(dataSheet);
            });
            // set status for evaluator
            sheet.skipScoringSettings = { skip_obj: [] };
            sheet.evaluator_status = {};
            sheet.evaluator_status.user_status = {};
            sheet.evaluator_status.final_status = resources_1.StatusEnum.INPROGRESS;
            Enumerable.from(event.teamMembers.allEvaluators).forEach(evaluator => {
                sheet.evaluator_status.user_status[evaluator.userId] = resources_1.StatusEnum.INPROGRESS;
                sheet.skipScoringSettings.skip_obj.push({
                    evaluator_id: evaluator.userId,
                    skip: false,
                    Comment: ''
                });
            });
        });
    }
    allSheetComplete(event) {
        var allComplete = true;
        var asyncCalls = [];
        event.priceSheets.forEach(sheet => {
            asyncCalls.push(this.sheetIsComplete(sheet));
        });
        return Q.allSettled(asyncCalls).then(res => {
            var errors = [];
            res.forEach(data => {
                if (!data.value["status"]) {
                    errors.push(data.value["name"]);
                    allComplete = false;
                }
            });
            return Q.resolve({ errors: errors, status: allComplete });
        });
    }
    /**
     * criteria for a sheet complete is all mandatory columns are filled with cell data
     * @param sheet
     */
    sheetIsComplete(sheet) {
        var sheetComplete = true;
        //TODO find a way to only fetch mandatory columns
        var columns = sheet.colSchema;
        var mandatoryColumns = Enumerable.from(columns).where((x) => {
            return (x.mandatory == true && !x.allowSupplierInput);
        }).select(y => y.virtualId).toArray();
        //if (!mandatoryColumns || mandatoryColumns.length == 0) {
        //    return Q.when({ name: sheet.name, status: sheetComplete });
        //}
        var allColumns = Enumerable.from(columns).select(x => x.virtualId).toArray();
        return this.dataRowRepository.getUnfilledRows(allColumns, sheet._id.toHexString()).then((rows) => {
            return this.dataSheetRepository.getBuyerTotalPropertyValue([sheet._id.toHexString()], { 'isAutoSum': { '$exists': false } }, mandatoryColumns, 'count').then(result => {
                if (result) {
                    var count = result.count - rows.length;
                    if (count == 0) {
                        sheetComplete = false;
                        this.logger.logInfo("Sheet " + sheet.name + " doesn't have any row data for event " + sheet.eventId);
                    }
                    sheet.rowsCount = count;
                    Enumerable.from(mandatoryColumns).forEach(id => {
                        if (result[id] != count) {
                            sheetComplete = false;
                            this.logger.logInfo("Sheet " + sheet.name + " is not complete for event " + sheet.eventId);
                        }
                    });
                }
                return Q.when({ name: sheet.name, status: sheetComplete });
            });
        });
        //TODO handle is autosum row
    }
    sheetIsCompleteWithRowData(sheet) {
        var sheetComplete = true;
        // Get all the mandatory columns
        var columns = sheet.colSchema;
        var mandatoryColumns = columns.filter(x => x.mandatory === true && !x.allowSupplierInput).map(x => x._id);
        if (!mandatoryColumns || mandatoryColumns.length == 0) {
            return Q.when(sheetComplete);
        }
    }
    supplierSetting(suppliersNet) {
        return this.eventRepository.findWhere({ 'documentCode': suppliersNet.documentCode }, [], false).then((events) => {
            principalContext_1.PrincipalContext.User.viewContext = resources_1.PriceSheetViewContextEnum.SHEET_DB_CONTEXT;
            var event = events[0];
            var eventId = event._id.toHexString();
            return this.priceSheetRepo.findWhere({ 'eventId': eventId, 'isSheetValid': true, 'isPushToRepository': false }, [], false).then((priceSheets) => {
                return this.quesnnaireRepo.findWhere({ 'event': mongoose.Types.ObjectId(eventId), 'isValid': true, 'isPushToRepository': false }, [], false).then((questionnaires) => {
                    return this.guidelineRepo.findWhere({ 'eventId': eventId, 'isGuidelineValid': true, 'isPushToRepository': false }, [], false).then((guidelines) => {
                        event.priceSheets = priceSheets;
                        Enumerable.from(suppliersNet.suppliers).forEach((supplier) => {
                            var sup = new user_1.User();
                            sup.setSupplier(supplier);
                            sup.status = supplier.supplierStatus;
                            event.setSupplier(sup);
                        });
                        Enumerable.from(priceSheets).forEach((sheet) => {
                            sheet.supplierTimeStamp = {};
                            Enumerable.from(suppliersNet.suppliers).forEach((supplier) => {
                                var suppSheet = new user_1.User();
                                suppSheet.setSupplier(supplier);
                                suppSheet.setTeamMember(supplier.primaryContact);
                                suppSheet.currency = event.eventCurrency || 'USD';
                                suppSheet.status = supplier.supplierStatus;
                                sheet.setSupplier(suppSheet);
                                if (!sheet.supplierTimeStamp)
                                    sheet.supplierTimeStamp = {};
                                sheet.supplierTimeStamp[suppSheet.userId] = null;
                            });
                        });
                        Enumerable.from(questionnaires).forEach((questionnaire) => {
                            //sheet.supplierTimeStamp = {};
                            Enumerable.from(suppliersNet.suppliers).forEach((supplier) => {
                                var suppSheet = new user_1.User();
                                suppSheet.setSupplier(supplier);
                                suppSheet.setTeamMember(supplier.primaryContact);
                                suppSheet.currency = event.eventCurrency || 'USD';
                                suppSheet.status = supplier.supplierStatus;
                                questionnaire.setSupplier(suppSheet);
                                // if (!sheet.supplierTimeStamp) sheet.supplierTimeStamp = {};
                                //sheet.supplierTimeStamp[suppSheet.userId] = null;
                            });
                        });
                        Enumerable.from(guidelines).forEach((guideline) => {
                            guideline.supplierTimeStamp = {};
                            Enumerable.from(suppliersNet.suppliers).forEach((supplier) => {
                                var suppGuideline = new user_1.User();
                                suppGuideline.setTeamMember(supplier.primaryContact);
                                suppGuideline.currency = event.eventCurrency || 'USD';
                                suppGuideline.status = supplier.supplierStatus;
                                guideline.setSupplier(suppGuideline);
                                //TODO : Refactor this code
                                var supplierGlAccept = new supplierAcceptance_1.SupplierAcceptance();
                                supplierGlAccept.setTeamMember(supplier.primaryContact);
                                supplierGlAccept.currency = event.eventCurrency || 'USD';
                                supplierGlAccept.status = supplier.supplierStatus;
                                supplierGlAccept.acceptanceStatus = false;
                                guideline.setSupplierAcceptance(supplierGlAccept);
                            });
                        });
                        var allAsyncCalls = [];
                        var eventObj = { 'event': null };
                        eventObj['event'] = event;
                        allAsyncCalls.push(this.revokeSuppliers(suppliersNet, eventObj));
                        allAsyncCalls.push(this.inviteSuppliers(suppliersNet, eventObj));
                        return Q.allSettled(allAsyncCalls).then(success => {
                            Enumerable.from(eventObj.event.priceSheets).forEach((sheet) => {
                                delete sheet.dataSheet;
                                delete sheet.colSchema;
                                delete sheet.buyerDataSheets;
                                delete sheet.buyerFormatSheets;
                                delete sheet.supplierSheets;
                            });
                            return this.eventRepository.put(eventId, eventObj.event).then(suces => {
                                return this.priceSheetRepo.bulkPut(eventObj.event.priceSheets).then(success => {
                                    return this.quesnnaireRepo.bulkPut(questionnaires).then(result => {
                                        return this.guidelineRepo.bulkPut(guidelines).then(response => {
                                            return success;
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }).catch(err => {
            return Q.reject(err);
        });
    }
    revokeSuppliers(suppliersNet, eventObj) {
        //remove access mask from that event and all pricesheets for the suppliers mentions to revoke
        //find where datasheet , sheetid, event id, supplier id and make those sheets access mask null for that supplier(dnt fetch rows)
        //make access mask from all supplier input column as null for revoked suppliers
        //remove this datasheet from supplierdatasheet array in events.
        //also check if publish only then revoke
        //if that supplier has submitted, dont revoke
        //dont delete datasheet for that supplier, we need to retain the data for reinvite.
        if (!eventObj.event.isPublished) {
            return Q.when('event not published yet');
        }
        var revokingSuppArr = [];
        var sheetIdArr = [];
        var suppIdArr = this.revokeSuppValidation(suppliersNet, eventObj, revokingSuppArr, sheetIdArr);
        if (!suppIdArr)
            return Q.when('cannot revoke');
        var revokingSupplierIds = revokingSuppArr.map(x => x.userId);
        return this.priceSheetRepo.findWhere({ '_id': { '$in': sheetIdArr } }, ['suppliers', 'colSchema', 'supplierSheets', 'usersAccessMask']).then((priceSheets) => {
            return this.dataSheetRepository.findWhere({ 's_id': { '$in': suppIdArr }, 'parentId': { '$in': sheetIdArr } }, [], false).then((dataSheets) => {
                let asyncCals = [];
                eventObj.event.removeAccessMask(suppIdArr);
                var newSupplierCount = Enumerable.from(eventObj.event.suppliers).where((x) => {
                    return (x.status == resources_1.SupplierStatus.INVITE && revokingSupplierIds.indexOf(x.userId) < 0);
                }).count();
                eventObj.event.totalSuppliersInvited = newSupplierCount ? newSupplierCount : 0;
                eventObj.event.priceSheets = priceSheets;
                Enumerable.from(priceSheets).forEach((sheet) => {
                    sheet.removeAccessMask(suppIdArr);
                    sheet.removeSupDataSheetIdFromList(dataSheets);
                });
                Enumerable.from(revokingSuppArr).forEach((sup) => {
                    sup.status = resources_1.SupplierStatus.REVOKE;
                });
                Enumerable.from(dataSheets).forEach((dtaSheet) => {
                    dtaSheet.removeAccessMask(suppIdArr);
                });
                Enumerable.from(priceSheets).forEach((sht) => {
                    asyncCals.push(this.priceSheetRepo.put(sht._id, { 'supplierSheets': sht.supplierSheets }));
                    asyncCals.push(this.columnRepository.bulkPut(sht.colSchema));
                    asyncCals.push(this.dataSheetRepository.bulkPut(dataSheets));
                });
                return Q.allSettled(asyncCals).then(success => {
                    return success;
                });
            });
        }).catch(error => {
            return Q.reject(error);
        });
    }
    revokeSuppValidation(suppliersNet, eventObj, revokingSuppArr, sheetIdArr) {
        var revokeSuppliersArr = [];
        var isRevokeRequest = false;
        Enumerable.from(suppliersNet.suppliers).forEach((supp) => {
            if (supp.supplierStatus == resources_1.SupplierStatus.REVOKE) {
                isRevokeRequest = true;
                revokeSuppliersArr.push(supp);
            }
        });
        if (!isRevokeRequest)
            return null;
        revokeSuppliersArr = eventObj.event.getSuppliersNotSubmitted(revokeSuppliersArr);
        if (!revokeSuppliersArr || !revokeSuppliersArr.length)
            return null;
        Enumerable.from(eventObj.event.priceSheets).forEach((x) => {
            sheetIdArr.push(x._id.toHexString());
        });
        var suppIdArr = [];
        Enumerable.from(revokeSuppliersArr).forEach((supp) => {
            Enumerable.from(eventObj.event.suppliers).forEach((sup) => {
                if (sup.userId == supp.primaryContact.contactCode && sup.status == resources_1.SupplierStatus.INVITE) {
                    revokingSuppArr.push(sup);
                    suppIdArr.push(sup.userId);
                }
            });
        });
        return suppIdArr;
    }
    inviteSuppliers(suppliersNet, eventObj) {
        if (!eventObj.event.isPublished) {
            return Q.when('event not published yet');
        }
        var inviteSuppliersArr = [];
        var isInviteRequest = false;
        Enumerable.from(suppliersNet.suppliers).forEach((supp) => {
            if (supp.supplierStatus == resources_1.SupplierStatus.INVITE) {
                isInviteRequest = true;
                inviteSuppliersArr.push(supp);
            }
        });
        if (!isInviteRequest)
            return Q.when('Not an invite request');
        return this.eventRepository.findEventWithSheet(eventObj.event._id).then((psevent) => {
            var asyncCals = [];
            eventObj.event = psevent;
            var event = eventObj.event;
            Enumerable.from(event.priceSheets).forEach((sheet) => {
                asyncCals.push(this.checkIfSheetExistsAndUpdate(sheet, event, inviteSuppliersArr));
            });
            return Q.allSettled(asyncCals).then(suces => {
                return suces;
            });
        }).catch(error => {
            return Q.reject(error);
        });
        //check if for that supplier datasheet already exists
        //if YES change access  mask in the datasheet
        //if NO create a new datasheet as usual with required access mask for each pricesheet
        //for all supplier input true columns give access  mask as readwrite in columns
        //give access read in event and sheets(all sheets)
        //do it only if event is published
        //make all event's suppliers status as invited during PUBLISH event codeing
        //handle case for if already invited, dont invite twice
    }
    checkIfSheetExistsAndUpdate(sheet, event, inviteSuppliersArr) {
        var invitingSuppliers = [];
        var asyncCals = [];
        let orgRows = new Array();
        sheet.dataSheet.dataRows.forEach(row => {
            orgRows.push(row);
        });
        var suppIdArr = [];
        Enumerable.from(inviteSuppliersArr).forEach((supp) => {
            Enumerable.from(sheet.suppliers).forEach(sup => {
                if (sup.userId == supp.primaryContact.contactCode && sup.currency) {
                    invitingSuppliers.push(sup);
                    suppIdArr.push(sup.userId);
                }
            });
        });
        return this.dataSheetRepository.findWhere({ 's_id': { '$in': suppIdArr }, 'parentId': sheet._id.toHexString() }, [], false).then((dataSheets) => {
            this.setUserAccessMaskInvite(event, false, invitingSuppliers, sheet);
            event.markSelectedSuppliersInvited(invitingSuppliers); //make their status as invite in event object, earlier it will be added.
            var newSupplierCount = Enumerable.from(event.suppliers).where((x) => {
                return (x.status == resources_1.SupplierStatus.INVITE);
            }).count();
            event.totalSuppliersInvited = newSupplierCount ? newSupplierCount : 0;
            Enumerable.from(invitingSuppliers).forEach((supplier, index) => {
                var dataSheet = this.presentInList(supplier.userId, dataSheets);
                if (supplier.currency && !dataSheet) {
                    this._priceSheetService.createRowsForSuppliers(event, sheet, supplier, orgRows);
                }
                if (supplier.currency && dataSheet) {
                    dataSheet.usersAccessMask[supplier.userId] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READWRITE];
                    asyncCals.push(this.dataSheetRepository.put(dataSheet._id, dataSheet));
                    if (!sheet.supplierSheets)
                        sheet.supplierSheets = [];
                    this.addIfNotExist(dataSheet, sheet.supplierSheets);
                }
            });
            asyncCals.push(this.priceSheetRepo.put(sheet._id, { 'supplierSheets': sheet.supplierSheets }));
            asyncCals.push(this.columnRepository.bulkPut(sheet.colSchema));
            return Q.allSettled(asyncCals).then(successc => {
                return successc;
            });
        });
    }
    presentInList(id, dataSheets) {
        var isPresent = null;
        Enumerable.from(dataSheets).forEach(sheet => {
            if (sheet.s_id == id) {
                isPresent = sheet;
            }
        });
        return isPresent;
    }
    addIfNotExist(dataSheet, supplierSheetList) {
        var isPresent = false;
        Enumerable.from(supplierSheetList).forEach((sheet) => {
            if (sheet._id && sheet._id.toHexString() == dataSheet._id.toHexString()) {
                isPresent = true;
                return;
            }
            if (sheet.toHexString() == dataSheet._id.toHexString()) {
                isPresent = true;
                return;
            }
        });
        if (!isPresent) {
            supplierSheetList.push(dataSheet);
        }
    }
    setUserAccessMaskInvite(event, cascade, invitingSuppliers, pSheet) {
        var userAccessMask = {};
        Enumerable.from(invitingSuppliers).forEach(sup => {
            userAccessMask[sup.userId] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ];
        });
        if (cascade) {
            event.setUserAccessMask(userAccessMask);
        }
        else {
            event.setUsersAccessMaskWithoutCascade(userAccessMask);
        }
        event.priceSheets.forEach((sheet) => {
            if (pSheet._id.toString() != sheet._id.toString()) {
                return;
            }
            let userAccessMaskSheet = {};
            Enumerable.from(invitingSuppliers).forEach(sup => {
                if (sup && sup.userId && sup.currency) {
                    userAccessMaskSheet[sup.userId] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READ];
                }
            });
            sheet.setUserAccessMask(userAccessMaskSheet);
            let suppliersColms = Enumerable.from(sheet.colSchema).where((col) => col.allowSupplierInput == true).toArray();
            suppliersColms.forEach((sCol) => {
                Enumerable.from(invitingSuppliers).forEach(sup => {
                    if (sup.currency) {
                        sCol.usersAccessMask[sup.userId] = security_config_1.PermissionGroupAccess[security_config_1.PermissionGroupAccess.P_READWRITE];
                    }
                });
            });
        });
    }
    resetEventSettings(event, dbEvent) {
        if (event.eventSettings && dbEvent.eventSettings && event.eventSettings.priceScoring != dbEvent.eventSettings.priceScoring) {
            event.resetAccessMask = true;
            event.sheetEvaluators = (event.eventSettings.priceScoring && event.teamMembers) ? event.teamMembers.allEvaluators : [];
        }
        if (event.eventSettings && dbEvent.eventSettings && event.eventSettings.questionnaire != dbEvent.eventSettings.questionnaire) {
            event.resetAccessMask = true;
            event.questionnaireEvaluators = (event.eventSettings.questionnaire && event.teamMembers) ? event.teamMembers.allEvaluators : [];
        }
    }
    updateEventChildren(event, dbEvent) {
        var asyncCalls = [];
        var subcalls = [];
        var multiCurrency = (event.eventCurrency != dbEvent.eventCurrency) || (event.eventSettings && dbEvent.eventSettings && dbEvent.eventSettings.multicurrency != event.eventSettings.multicurrency && !event.eventSettings.multicurrency);
        var priceSheetScoring = event.eventSettings && dbEvent.eventSettings && event.eventSettings.priceScoring != dbEvent.eventSettings.priceScoring;
        var questionnaireScoring = event.eventSettings && dbEvent.eventSettings && event.eventSettings.questionnaire != dbEvent.eventSettings.questionnaire;
        if (multiCurrency || priceSheetScoring) {
            asyncCalls.push(this.priceSheetRepo.findWhere({ 'eventId': event._id.toString(), 'isSheetValid': true, 'isPushToRepository': false }, [], false).then((priceSheets) => {
                Enumerable.from(priceSheets).forEach((sheet) => {
                    var changed = false;
                    if (priceSheetScoring) {
                        sheet.evaluators = (event.eventSettings.priceScoring && event.teamMembers) ? event.teamMembers.allEvaluators : [];
                        sheet.resetAccessMask = true;
                        changed = true;
                    }
                    if (multiCurrency) {
                        sheet.suppliers.forEach(sup => {
                            if (sup.currency) {
                                sup.currency = event.eventCurrency.toString();
                                changed = true;
                            }
                        });
                    }
                    if (changed)
                        subcalls.push(this.priceSheetRepo.put(sheet._id.toString(), sheet));
                });
            }));
        }
        if (questionnaireScoring) {
            asyncCalls.push(this.quesnnaireRepo.findWhere({ 'event': mongoose.Types.ObjectId(event._id.toString()), 'isValid': true, 'isPushToRepository': false }, [], false).then((questionnaires) => {
                Enumerable.from(questionnaires).forEach((questionnaire) => {
                    questionnaire.evaluators = (event.eventSettings.questionnaire && event.teamMembers) ? event.teamMembers.allEvaluators : [];
                    questionnaire.resetAccessMask = true;
                    subcalls.push(this.quesnnaireRepo.put(questionnaire._id.toString(), questionnaire));
                });
            }));
        }
        return Q.allSettled(asyncCalls).then(res => {
            return Q.allSettled(subcalls).then(res => {
                return res;
            });
        }).catch(err => {
            console.log(err);
            throw err;
        });
    }
    /**
     * method dedicated to set team members in event and cascade the info to price sheet.
     */
    teamMemberSetting(teamMemberNet) {
        return this.eventRepository.findWhere({ 'documentCode': teamMemberNet.documentCode }, [], false).then((events) => {
            principalContext_1.PrincipalContext.User.viewContext = resources_1.PriceSheetViewContextEnum.SHEET_DB_CONTEXT;
            //return this.eventRepository.findWhere({ '_id': "58467aba12d76454193dc23a" }, ['teamMembers', 'coAuthors', 'sheetCoAuthors', 'sheetEvaluators', 'evaluators', 'viewers']).then((events: Array<PsEvent>) => {
            var event = events[0];
            var eventId = event._id.toHexString();
            return this.priceSheetRepo.findWhere({ 'eventId': eventId, 'isSheetValid': true, 'isPushToRepository': false }, [], false).then((priceSheets) => {
                return this.quesnnaireRepo.findWhere({ 'event': mongoose.Types.ObjectId(eventId), 'isValid': true, 'isPushToRepository': false }, [], true).then((questionnaires) => {
                    return this.guidelineRepo.findWhere({ 'eventId': eventId, 'isGuidelineValid': true, 'isPushToRepository': false }, [], false).then((guidelines) => {
                        event.resetAccessMask = true;
                        teamMemberNet.lstTeamMembers.forEach(teamMember => {
                            event.setTeamMemberEvent(teamMember);
                        });
                        Enumerable.from(priceSheets).forEach((sheet) => {
                            sheet.teamMembers = event.teamMembers;
                            sheet.resetAccessMask = true;
                            teamMemberNet.lstTeamMembers.forEach(teamMember => {
                                sheet.setTeamMemberSheet(teamMember, event);
                            });
                        });
                        Enumerable.from(questionnaires).forEach((questionnaire) => {
                            questionnaire.teamMembers = event.teamMembers;
                            questionnaire.resetAccessMask = true;
                            teamMemberNet.lstTeamMembers.forEach(teamMember => {
                                questionnaire.setTeamMemberQuestionnaire(teamMember, event);
                            });
                        });
                        Enumerable.from(guidelines).forEach((guideline) => {
                            guideline.teamMembers = event.teamMembers;
                            guideline.resetAccessMask = true;
                            teamMemberNet.lstTeamMembers.forEach(teamMember => {
                                guideline.setTeamMemberGuideline(teamMember, event);
                            });
                        });
                        return this.eventRepository.put(eventId, event).then(success => {
                            var asyncCalls = [];
                            Enumerable.from(priceSheets).forEach(sht => {
                                asyncCalls.push(this.priceSheetRepo.put(sht._id, sht));
                            });
                            Enumerable.from(questionnaires).forEach((qus) => {
                                qus.resetAccessMask = true;
                                asyncCalls.push(this.quesnnaireRepo.put(qus._id, qus));
                            });
                            Enumerable.from(guidelines).forEach(gl => {
                                asyncCalls.push(this.guidelineRepo.put(gl._id, gl));
                            });
                            return Q.allSettled(asyncCalls).then(suces => {
                                return suces;
                            })
                                .catch(err => {
                                console.error(err);
                                throw err;
                            });
                        }).catch(err => {
                            console.log(err);
                            throw err;
                        });
                    });
                });
            });
        }).catch(err => {
            return Q.reject(err);
        });
        //fetch the event as in the teamMember object sent from .net side
        //event fetched will have properties like teammembers,viewers,evaluators,coauthors,sheetevaluators,sheetcoauthors.
        //fetch all the pricesheets with the parent id as this event id.but pricesheets with only id, usersaccessmask,teammembers,coauthors, evaluators etc.
        //No need to get the columns
        //read the json from .net end, iterate it and set all team members in event and pricesheet.
        //Also set the coauthors, evaluators etc in both event and pricesheet
        //save the event and pricesheet, bulkput many
        //then invoke assignEventAccess and assignPriceSheetAccess from both services to reset access  masks.(here its getting invoked by put in event repo)
    }
    /**
     * method to assign co authors for an event
     * @param eventId
     */
    assignEventAccess(eventObj) {
        if (!eventObj.resetAccessMask)
            return Q.when(eventObj);
        var eventId = eventObj._id;
        if (!eventId)
            return;
        var currentUser = principalContext_1.PrincipalContext.User;
        var role = currentUser.getUserRole();
        if ((eventObj.createdBy != currentUser.userId) && !eventObj.isEventCoAuthor(currentUser)) {
            throw "not eligible to assign user access in event";
        }
        console.log('eventService:[assignCoAuthors]', 'event id:', eventId, 'user info', currentUser.getUsername());
        var event = eventObj;
        let userAccessMask = event.usersAccessMask || {};
        if (!event.coAuthors)
            event.coAuthors = [];
        if (!event.evaluators)
            event.evaluators = [];
        if (!event.viewers)
            event.viewers = [];
        event.setAccessMaskForTeamMemberAsign(userAccessMask, eventObj.isPublished);
        // don't cascade set userAccessMask to all its childrens
        event.setUsersAccessMaskWithoutCascade(userAccessMask);
        var eventObject = {};
        eventObject['usersAccessMask'] = userAccessMask;
        //TODO change bulkputmany, so final result wont be entire event object
        return this.eventRepository.bulkPutMany([event._id], eventObject).then(finalEvent => {
            //invoke event.getEventLevelCoAuthors() and call the .net api everytime this is invoked
            this._rfxExternalService.updateEventLevelCoAuthors(event);
            return Q.when(eventObj);
        }).catch(error => {
            console.log('eventService:[assignEventAccess]', 'event id:', 'error', error, eventId, 'user info', currentUser.getUsername());
            return Q.reject(error);
        });
    }
    /**
     * process the event entity in fetched data from db
     * @param entity
     */
    postRead(entity) {
        console.log('access mask for event2 ', entity.accessMask);
        let curUser = principalContext_1.PrincipalContext.User;
        let role = utility.getCurrentUserRole(curUser, entity);
        !entity.visibilityMask && (entity.visibilityMask = 0);
        console.log('eventService:[postRead]', 'user info', curUser.getUsername());
        this.grantUpdateTeamMembersPermissionToBuyer(entity, curUser, role);
        if (!entity.showMultiCurrency()) {
            entity.currencyList = [];
        }
        if ((entity.isEventCoAuthor(curUser) || entity.createdBy == curUser.userId)) {
            entity.visibilityMask = entity.visibilityMask | resources_1.EventVisibilityMask.CAN_VIEW_TEAM_MEMBER;
        }
        if ((entity.isEventCoAuthor(curUser) || role == security_config_1.RoleEnum[security_config_1.RoleEnum.ROLE_AUTHOR]) && !entity.isPublished) {
            entity.visibilityMask = entity.visibilityMask | resources_1.EventVisibilityMask.CAN_DELETE_SHEET | resources_1.EventVisibilityMask.CAN_ADD_SHEET
                | resources_1.EventVisibilityMask.CAN_EDIT_EVENT | resources_1.EventVisibilityMask.CAN_EDIT_PRICESHEET | resources_1.EventVisibilityMask.CAN_VIEW_PROGRESS_STATUS;
            (entity.createdBy === curUser.userId) && (entity.visibilityMask += resources_1.EventVisibilityMask.CAN_PUBLISH_EVENT);
            return Q.when(entity);
        }
        if (!entity.isPublished) {
            return Q.when(entity);
        }
        //if (entity.isEventCoAuthor(curUser)) {
        //    entity.visibilityMask = entity.visibilityMask | EventVisibilityMask.CAN_DELETE_SHEET;
        //}
        if (entity.teamMembers &&
            entity.teamMembers.allEvaluators &&
            entity.teamMembers.allEvaluators.length &&
            role != security_config_1.RoleEnum[security_config_1.RoleEnum.ROLE_COAUTHOREVALUATOR] &&
            role != security_config_1.RoleEnum[security_config_1.RoleEnum.ROLE_EVALUATOR]) {
            var isEvaluator = false;
            Enumerable.from(entity.teamMembers.allEvaluators).forEach(evaluator => {
                if (evaluator.userId == curUser.userId) {
                    isEvaluator = true;
                }
            });
            if (isEvaluator) {
                entity.visibilityMask = entity.visibilityMask | resources_1.EventVisibilityMask.CAN_VIEW_SKIP_SCORING;
                if (entity.canSubmitEvaluator()) {
                    entity.visibilityMask += resources_1.EventVisibilityMask.CAN_SEE_SUBMIT_SUPPLIER_POPUP;
                }
                if (entity.isItemLevelScoringEnabled()) {
                    entity.visibilityMask += resources_1.EventVisibilityMask.CAN_EVALUATOR_SCORE;
                }
            }
        }
        if (entity.isPublished) {
            switch (role) {
                case security_config_1.RoleEnum[security_config_1.RoleEnum.ROLE_AUTHOR]:
                    entity.visibilityMask += resources_1.EventVisibilityMask.CAN_ADD_COLUMNS_IN_ANALYZE_VIEW | resources_1.EventVisibilityMask.CAN_SEE_EVALUATION_VIEW
                        | resources_1.EventVisibilityMask.CAN_VIEW_PROGRESS_STATUS;
                    if (entity.showResponseWorkbench())
                        entity.visibilityMask += resources_1.EventVisibilityMask.CAN_SEE_RESPONSEWORKBENCH;
                    entity['isAuthor'] = (entity.createdBy == curUser.userId);
                    return Q.when(entity);
                case security_config_1.RoleEnum[security_config_1.RoleEnum.ROLE_VIEWER]:
                    entity.visibilityMask += resources_1.EventVisibilityMask.CAN_ADD_COLUMNS_IN_ANALYZE_VIEW | resources_1.EventVisibilityMask.CAN_SEE_EVALUATION_VIEW;
                    if (entity.showResponseWorkbench())
                        entity.visibilityMask += resources_1.EventVisibilityMask.CAN_SEE_RESPONSEWORKBENCH;
                    entity['isAuthor'] = (entity.createdBy == curUser.userId);
                    return Q.when(entity);
                case security_config_1.RoleEnum[security_config_1.RoleEnum.ROLE_EVALUATOR]:
                    if (entity.canSubmitEvaluator()) {
                        entity.visibilityMask += resources_1.EventVisibilityMask.CAN_SEE_SUBMIT_SUPPLIER_POPUP;
                    }
                    if (entity.showSkipScore()) {
                        entity.visibilityMask += resources_1.EventVisibilityMask.CAN_VIEW_SKIP_SCORING;
                    }
                    if (entity.showResponseWorkbench())
                        entity.visibilityMask += resources_1.EventVisibilityMask.CAN_SEE_RESPONSEWORKBENCH;
                    if (entity.isItemLevelScoringEnabled()) {
                        entity.visibilityMask += resources_1.EventVisibilityMask.CAN_EVALUATOR_SCORE;
                    }
                    var currentSubmittedEvaluator = Enumerable.from(entity.evaluatorsSubmitted).firstOrDefault((e) => e.userId === curUser.userId);
                    if (currentSubmittedEvaluator && currentSubmittedEvaluator.submittedSupplierIds && currentSubmittedEvaluator.submittedSupplierIds.length > 0) {
                        entity.suppliersSubmittedByCurrentEvaluator = currentSubmittedEvaluator.submittedSupplierIds;
                    }
                    return Q.when(entity);
                case security_config_1.RoleEnum[security_config_1.RoleEnum.ROLE_COAUTHOREVALUATOR]:
                    entity.visibilityMask += resources_1.EventVisibilityMask.CAN_ADD_COLUMNS_IN_ANALYZE_VIEW | resources_1.EventVisibilityMask.CAN_SEE_EVALUATION_VIEW;
                    if (entity.canSubmitEvaluator()) {
                        entity.visibilityMask += resources_1.EventVisibilityMask.CAN_SEE_SUBMIT_SUPPLIER_POPUP;
                    }
                    if (entity.showSkipScore()) {
                        entity.visibilityMask += resources_1.EventVisibilityMask.CAN_VIEW_SKIP_SCORING;
                    }
                    if (entity.showResponseWorkbench())
                        entity.visibilityMask += resources_1.EventVisibilityMask.CAN_SEE_RESPONSEWORKBENCH;
                    if (entity.isItemLevelScoringEnabled()) {
                        entity.visibilityMask += resources_1.EventVisibilityMask.CAN_EVALUATOR_SCORE;
                    }
                    entity['isAuthor'] = (entity.createdBy == curUser.userId);
                    let currentSubmittedEvaluator1 = Enumerable.from(entity.evaluatorsSubmitted).firstOrDefault((e) => e.userId === curUser.userId);
                    if (currentSubmittedEvaluator1 && currentSubmittedEvaluator1.submittedSupplierIds && currentSubmittedEvaluator1.submittedSupplierIds.length > 0) {
                        entity.suppliersSubmittedByCurrentEvaluator = currentSubmittedEvaluator1.submittedSupplierIds;
                    }
                    return Q.when(entity);
                case security_config_1.RoleEnum[security_config_1.RoleEnum.ROLE_SUPPLIER]:
                    entity.visibilityMask += resources_1.EventVisibilityMask.CAN_SEE_SUPPLIER_CELL_COVERAGE | resources_1.EventVisibilityMask.CAN_VIEW_RESPONSE_ICON;
                    let isResonseSubmittedSupplier = Enumerable.from(entity.suppliersSubmitted).where((s) => s.userId === curUser.userId).firstOrDefault()
                        ? true
                        : false;
                    !isResonseSubmittedSupplier && (entity.visibilityMask += resources_1.EventVisibilityMask.CAN_SUPPLIER_RESPONSE);
                    return this.setSupplierTotalCellCoverage(entity, curUser.userId).then((priceSheetsPriomse) => {
                        entity.priceSheets = [];
                        priceSheetsPriomse.forEach(sheetPromise => {
                            entity.priceSheets.push(this.updateSupplierTimeStamp(curUser, sheetPromise.value));
                        });
                        return Q.when(entity);
                    });
            }
        }
    }
    /**
     * Give team member update permission to buyer
     * @param entity
     * @param curUser
     */
    grantUpdateTeamMembersPermissionToBuyer(entity, curUser, role) {
        if (entity.isEventCoAuthor(curUser) || entity.createdBy == curUser.userId) {
            entity.visibilityMask += resources_1.EventVisibilityMask.CAN_UPDATE_TEAMMEMBERS;
        }
    }
    updateSupplierTimeStamp(curUser, sheet) {
        // will have to change this code when collaborators of supplier is added
        if (sheet.supplierTimeStamp && sheet.supplierTimeStamp[curUser.userId]) {
            sheet.lastModifiedBy = curUser.userId;
            var user = Enumerable.from(sheet.suppliers).firstOrDefault(x => x.userId == curUser.userId);
            sheet.lastModifiedByName = user ? user.userName : curUser.userName;
            sheet.lastModifiedDate = sheet.supplierTimeStamp[curUser.userId];
        }
        else {
            sheet.lastModifiedBy = null;
            sheet.lastModifiedByName = null;
            sheet.lastModifiedDate = null;
        }
        return sheet;
    }
    /**
     * find all suppliers inputVirtual columns and fetch corresponding cell count
     * @param event
     * @param supplierId
     */
    setSupplierTotalCellCoverage(event, supplierId) {
        let supplierInputVirtualIds = [];
        let intendToBidColVirtualId;
        if (!event.priceSheets)
            event.priceSheets = [];
        let asyncTasks = [];
        let asyncGetCoulms = [];
        event.priceSheets.forEach(sheet => {
            let getColum = this.priceSheetRepo.findWhere({ "_id": sheet._id }, ["colSchema"]).then((result) => {
                sheet.colSchema = result[0].colSchema;
                return Q.when(sheet);
            });
            asyncGetCoulms.push(getColum);
        });
        return Q.allSettled(asyncGetCoulms).then((priceSheetsPriomse) => {
            priceSheetsPriomse.forEach(sheetPromise => {
                let sheet = sheetPromise.value;
                supplierInputVirtualIds = [];
                sheet.colSchema.forEach(col => {
                    if (col.allowSupplierInput) {
                        if (col.name === commonConstants_1.CommonConstants.IntentToBid) {
                            intendToBidColVirtualId = col.virtualId.valueOf();
                            return;
                        }
                        supplierInputVirtualIds.push(col.virtualId.valueOf());
                        return;
                    }
                });
                let task = this.getSupplierCellCoverageCount(sheet, supplierInputVirtualIds, intendToBidColVirtualId, supplierId).then(percentage => {
                    sheet.supplierCellCoveragePercentage = percentage;
                    return Q.when(sheet);
                });
                asyncTasks.push(task);
            });
            return Q.allSettled(asyncTasks).then(priceSheets => {
                return Q.when(priceSheets);
            });
        }).catch(error => {
            throw error;
        });
    }
    /**
     * calculate cell coverage % for supplier response
     * @param sheet
     * @param supplierInputColVirtualIds
     * @param intendToBidColVirtualId
     * @param supplierId
     */
    getSupplierCellCoverageCount(sheet, supplierInputColVirtualIds, intendToBidColVirtualId, supplierId) {
        let totalCellCoverageCount = 0;
        let totalOwnCellCount = 0;
        totalOwnCellCount = sheet.rowsCount * supplierInputColVirtualIds.length;
        //let vIdsQueryArry = supplierInputColVirtualIds.map(id => `$supplierDataRows.${id}`);
        //vIdsQueryArry.push(`$supplierDataRows.${CommonConstants.supplierId}`);
        return this.dataSheetRepository.getSupplierTotalPropertyValue([sheet._id.toHexString()], [supplierId], { "Intent to Bid": "Yes" }, supplierInputColVirtualIds, 'count').then(result => {
            if (!result)
                return Q.when(100);
            var intentBidYesRowcount = result.count;
            let intentBidNoRowcount = sheet.rowsCount - intentBidYesRowcount;
            let intentBidYesCellCoverageCount = 0;
            let intentBidNoCellCellCoverageCount = 0;
            supplierInputColVirtualIds.forEach(vId => {
                intentBidYesCellCoverageCount += result[vId];
            });
            intentBidNoCellCellCoverageCount = intentBidNoRowcount * supplierInputColVirtualIds.length; // all cells for intent to bid rows as 100% cell coverage
            //totalOwnCellCount -= intentBidNoCellCellCoverageCount;
            totalCellCoverageCount = intentBidYesCellCoverageCount + intentBidNoCellCellCoverageCount;
            let coveragePercentage = totalOwnCellCount ? (totalCellCoverageCount / totalOwnCellCount) * 100 : 0;
            return Q.when(coveragePercentage);
        }).catch(error => {
            throw error;
        });
    }
    setTeamMembers(eventId, teamMembers) {
        //fetch event with team members, accessmask,eventId
        //fetch all sheets with this event id with fields accessmask and column schema
        //fetch all data sheets with the pricesheet id fetched above (fetch only data sheet id)
        //set all the details fetched above and construct an event object
        //set this json object in event,override the existing team members key value pair
        //Read the team members json and create access mask
        //for event level masks set in event and cascade it to all the childrens
        //for all sheet and all questionnaires set it in respective sheets and questionnaires(patch)
        //for individual pricesheet and questionnaires set in those objects and call patch
        //cascade it to all childs except datarows if setting access mask at any level
        this.eventRepository.findWhere({ '_id': eventId }, [], false);
        return Q.when(true);
    }
    create(details, type) {
        if (type == undefined || type == null)
            return Q.reject(null);
        switch (type) {
            case messageBroker_interface_1.MessageType.EVENT:
                return this.eventRepository.doCreate(details);
            case messageBroker_interface_1.MessageType.TEAM_MEMBER:
                return this.eventRepository.doSetTeamMember(details);
        }
        return Q.reject("MessageType not specified");
    }
    update(object, type) {
        if (type == undefined || type == null)
            return Q.reject(null);
        switch (type) {
            case messageBroker_interface_1.MessageType.EVENT:
                return this.eventRepository.doUpdate(object);
            case messageBroker_interface_1.MessageType.TEAM_MEMBER:
                return this.eventRepository.doUpdate(object);
        }
        return Q.reject("MessageType not specified");
    }
    delete(object, type) {
        return this.eventRepository.doDelete(object.documentCode);
    }
    getAllEventPricesheets(eventId, event) {
        return this.priceSheetRepo.getPriceSheetsSelectedFields(eventId).then(sheets => {
            event.priceSheets = sheets;
            return Q.when(true);
        });
    }
    getAllEventQuestionnaires(eventId, event) {
        return this.quesnnaireRepo.getQuestionnaoiresSelectedFields(eventId).then(questionnaires => {
            event.questionnaires = questionnaires;
            return Q.when(true);
        });
    }
    getAllEventGuidelines(eventId, event) {
        return this.guidelineRepo.getGuidelineSelectedFields(eventId).then(guidelines => {
            event.guideLines = guidelines;
            return Q.when(true);
        });
        //return Q.when(true);
    }
    copyEvents(eventId, documentCode, metaData) {
        return this.eventRepository.findWhere({ '_id': mongoose.Types.ObjectId(eventId) }, [], false).then((eventList) => {
            var event = R.pipe(utility.checkifItemExists, R.head)(eventList);
            if (!event)
                throw 'no event found';
            var newEvent = this.createNewEvent(event, documentCode, metaData);
            this.setAllTeamMembersEvent(newEvent, metaData);
            this.setAllSuppliersEvent(newEvent, metaData);
            return this.eventRepository.post(newEvent).then((createdEvent) => {
                createdEvent.resetAccessMask = true;
                return this.assignEventAccess(createdEvent).then(succes => {
                    var copyWithouRows = metaData.isPushToRepo;
                    return this._priceSheetService.bulkCopySheet(R.map(R.toString, event.priceSheets), false, false, createdEvent._id.toHexString(), copyWithouRows).then(sheetSuccess => {
                        //   return this.quesnnaireRepo.bulkCopy(R.map(R.toString, event.questionnaires), false, false, createdEvent._id.toHexString());
                        return this.quesnnaireRepo.bulkCopy(R.map(R.toString, event.questionnaires), false, false, createdEvent._id.toHexString()).then(questionnaireSuccess => {
                            return this.guidelineService.bulkCopyGuideline(R.map(R.toString, event.guideLines), false, false, createdEvent._id.toHexString(), true).then(guidelineSuccess => {
                                return true;
                            });
                        });
                    });
                });
            });
        }).catch(err => {
            return Q.reject(err);
        });
    }
    createNewEvent(oldEvent, documentCode, metaData) {
        var tempEvent = R.pickBy(utility.getRequiredProps, oldEvent);
        var newEvent = new psevent_1.PsEvent();
        Object.assign(newEvent, tempEvent);
        newEvent.name = metaData.eventName;
        newEvent.documentCode = documentCode;
        newEvent.eventSettings = metaData.eventSettings ? metaData.eventSettings : newEvent.eventSettings;
        newEvent.sourceEventCode = oldEvent.documentCode;
        newEvent.isPushToRepo = false;
        if (metaData.isPushToRepo) {
            newEvent.isPushToRepo = true;
        }
        if (metaData.isImportFromRepo) {
            newEvent.category = metaData.category;
            newEvent.businessUnit = metaData.businessUnit;
            newEvent.region = metaData.region;
        }
        return newEvent;
    }
    setAllTeamMembersEvent(event, metaData) {
        let currentUser = principalContext_1.PrincipalContext.User;
        if (metaData && metaData.teamMembers) {
            event.teamMembers = {};
            var teamMemberNet = metaData.teamMembers;
            if (teamMemberNet.lstTeamMembers && teamMemberNet.lstTeamMembers.length) {
                teamMemberNet.lstTeamMembers.forEach(teamMember => {
                    event.setTeamMemberEvent(teamMember);
                });
                return;
            }
        }
        if (!event.teamMembers)
            return true;
        if (!event.teamMembers.allCoAuthors)
            event.teamMembers.allCoAuthors = [];
        if (!event.teamMembers.allEvaluators)
            event.teamMembers.allEvaluators = [];
        if (!event.teamMembers.allViewers)
            event.teamMembers.allViewers = [];
        this.deleteTeamMemberIfCurrentUser(currentUser.userId, event);
        event.coAuthors = event.teamMembers.allCoAuthors;
        event.evaluators = event.teamMembers.allEvaluators;
        event.viewers = event.teamMembers.allViewers;
        event.sheetCoAuthors = event.teamMembers.allCoAuthors;
        event.sheetEvaluators = event.teamMembers.allEvaluators;
        event.questionnaireCoAuthors = event.teamMembers.allCoAuthors;
        event.questionnaireEvaluators = event.teamMembers.allEvaluators;
    }
    setAllSuppliersEvent(event, metaData) {
        if (metaData && metaData.suppliers) {
            event.suppliers = [];
            var suppliersNet = metaData.suppliers;
            var teamMemberNet = metaData.suppliers;
            Enumerable.from(suppliersNet.suppliers).forEach((supplier) => {
                var sup = new user_1.User();
                sup.setSupplier(supplier);
                sup.status = supplier.supplierStatus;
                event.setSupplier(sup);
            });
            return;
        }
    }
    udpateEventForSubmissionForSupplier(eventId, userId) {
        return this.eventRepository.findWhere({ '_id': eventId }, [], false).then((event) => {
            event = event[0];
            if (!(Enumerable.from(event.suppliersSubmitted).any(u => u.userId == userId))) {
                if (!event.suppliersSubmitted)
                    event.suppliersSubmitted = [];
                event.suppliersSubmitted.push(new user_1.User({ userId: userId, userName: "", submittedSupplierIds: undefined }));
                event.totalSuppliersResponded = event.suppliersSubmitted.length;
                var resObj = {};
                resObj.suppliersSubmitted = event.suppliersSubmitted;
                resObj.totalSuppliersResponded = event.totalSuppliersResponded;
                resObj._id = event._id;
                principalContext_1.PrincipalContext.User.viewContext = resources_1.PriceSheetViewContextEnum.SHEET_DB_CONTEXT;
                return this.eventRepository.put(eventId, resObj).then(succuss => {
                    return this._rfxExternalService.updateSupplierStatus(event.documentCode);
                }).catch(exc => {
                    this.logger.logError(exc);
                    return Q.reject(exc);
                });
            }
        });
    }
    deleteTeamMemberIfCurrentUser(userId, event) {
        event.teamMembers.allCoAuthors = R.filter(R.where({ userId: R.complement(R.equals(userId)) }))(event.teamMembers.allCoAuthors);
        event.teamMembers.allEvaluators = R.filter(R.where({ userId: R.complement(R.equals(userId)) }))(event.teamMembers.allEvaluators);
        event.teamMembers.allViewers = R.filter(R.where({ userId: R.complement(R.equals(userId)) }))(event.teamMembers.allViewers);
    }
};
__decorate([
    inject_1.inject(LoggerService), 
    __metadata('design:type', LoggerService.LoggerService)
], EventService.prototype, "logger", void 0);
__decorate([
    inject_1.inject(priceSheetRepository), 
    __metadata('design:type', priceSheetRepository.PriceSheetRepository)
], EventService.prototype, "priceSheetRepo", void 0);
__decorate([
    inject_1.inject(guidelineRepository), 
    __metadata('design:type', guidelineRepository.GuidelineRepository)
], EventService.prototype, "guidelineRepo", void 0);
__decorate([
    inject_1.inject(), 
    __metadata('design:type', rfxExternalService_1.RFXExternalService)
], EventService.prototype, "_rfxExternalService", void 0);
__decorate([
    inject_1.inject(questionnaireRepository), 
    __metadata('design:type', questionnaireRepository.QuestionnaireRepository)
], EventService.prototype, "quesnnaireRepo", void 0);
__decorate([
    inject_1.inject(dataRowRepository), 
    __metadata('design:type', dataRowRepository.DataRowRepository)
], EventService.prototype, "dataRowRepository", void 0);
__decorate([
    inject_1.inject(columnRepository), 
    __metadata('design:type', columnRepository.ColumnRepository)
], EventService.prototype, "columnRepository", void 0);
__decorate([
    inject_1.inject(dataSheetRepository), 
    __metadata('design:type', dataSheetRepository.DataSheetRepository)
], EventService.prototype, "dataSheetRepository", void 0);
__decorate([
    inject_1.inject(eventRepo), 
    __metadata('design:type', eventRepo.EventRepository)
], EventService.prototype, "eventRepository", void 0);
__decorate([
    inject_1.inject(), 
    __metadata('design:type', sessionRepository_1.SessionRepository)
], EventService.prototype, "sessionRepository", void 0);
__decorate([
    inject_1.inject(priceSheetService), 
    __metadata('design:type', priceSheetService.PriceSheetService)
], EventService.prototype, "_priceSheetService", void 0);
__decorate([
    inject_1.inject(guidelineService), 
    __metadata('design:type', guidelineService.GuidelineService)
], EventService.prototype, "guidelineService", void 0);
EventService = __decorate([
    decorators_1.service({ singleton: true, serviceName: 'eventService' }), 
    __metadata('design:paramtypes', [])
], EventService);
exports.EventService = EventService;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EventService;

//# sourceMappingURL=eventService.js.map
