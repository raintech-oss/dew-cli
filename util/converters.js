'use strict';

const { noConflict } = require('lodash');
const _ = require('lodash');
const jovoModelHelper = require('@jovotech/model').JovoModelHelper;

async function convertSheetToJSON(sheet) {
    let json = [];

    const rows = await sheet.getRows();

    for (const row of rows) {
        let item = {};

        for (const header of sheet.headerValues) {
            const [title, type = 'string'] = header.split(':');
            const value = row[header];

            if (type === 'num') {
                item[title] = Number(typeof (value) === 'string' ? value : 0);
            } else if (type === 'bool') {
                item[title] = typeof (value) === 'string' ? ['TRUE', 'T', 'YES', 'Y'].includes(value.toUpperCase()) : false;
            } else if (type === 'ignore') {
                // skip value for column that ends in ":ignore"
            } else {
                item[title] = typeof (value) === 'undefined' ? '' : value;
            }

            if (typeof (value) === 'undefined') {
                continue;
            } else if (value.toUpperCase() === 'NULL') {
                item[title] = null;
            } else if (value.toUpperCase() === 'UNDEFINED') {
                item[title] = undefined;
            }
        }

        json.push(item);
    }

    return json;
}

async function convertSheetToTranslationJSON(sheet) {
    let translation = {};

    const rows = await sheet.getRows();

    for (const row of rows) {
        if (row.path) {
            const value = _.get(translation, row.path, null);
            if (value) {
                _.set(translation, row.path, _.concat(value, row.value));
            } else {
                _.set(translation, row.path, row.value);
            }
        }
    }

    return { translation };
}

async function convertSheetToV4TranslationJSON(sheet) {
    let translation = {};
    let currentEntry;
    let previousEntry;

    const rows = await sheet.getRows();

    for (const row of rows) {
        if (row.path) {
            const fullPath = row.type ? `${row.path}.${row.type}` : row.path;
            const config = getConfigForPath(row.type);

            // currentEntry is info about the current row from the sheet
            currentEntry = {
                fullPath,
                path: row.path,
                suffix: row.type,
                value: row.value,
                config,
            };

            if (!previousEntry) {
                // set previousEntry for the first time
                previousEntry = currentEntry;
            }

            // copy previous data to current when they are about the same object
            if (currentEntry.path === previousEntry.path &&
                currentEntry.config.pathEnd === previousEntry.config.pathEnd &&
                currentEntry.config.entryType === previousEntry.config.entryType &&
                previousEntry.data) {
                currentEntry.data = previousEntry.data;
            } else {
                currentEntry.data = null;
            }

            // update the array with the previous data when the currentEntry
            // changes: path, pathEnd, entryType or when previous was string or bool
            if (currentEntry.path !== previousEntry.path ||
                currentEntry.config.pathEnd !== previousEntry.config.pathEnd ||
                currentEntry.config.entryType !== previousEntry.config.entryType ||
                (previousEntry.data && ['string', 'boolean'].includes(previousEntry.config.entryType))) {

                setEntry(previousEntry, translation);
                previousEntry = currentEntry;
            }

            // set the data for the currentEntry
            if (currentEntry.config.entryType === 'string') {
                currentEntry.data = currentEntry.value;
            } else if (currentEntry.config.entryType === 'boolean') {
                currentEntry.data = currentEntry.value.toLowerCase() === 'true' ? true : false;;
            } else {
                // object
                if (!currentEntry.data) {
                    currentEntry.data = {};
                }

                const key = currentEntry.suffix.replace(`${currentEntry.config.pathEnd}.`, '');
                currentEntry.data[key] = currentEntry.value;
            }
        }
    }

    // set the last row in the sheet
    setEntry(previousEntry, translation);

    return { translation };
}

function setEntry(entry, translation) {
    const path = entry.suffix ? `${entry.path}.${entry.config.pathEnd}` : entry.path;
    const value = _.get(translation, path, null);
    if (value) {
        _.set(translation, path, _.concat(value, entry.data));
    } else {
        _.set(translation, path, entry.data);
    }
}

function getConfigForPath(pathType) {
    // rules mappings based on specific type values
    const configMap = {
        'message': {
            isParentArray: true,
            pathEnd: 'message',
            entryType: 'string',
        },
        'message.text': {
            isParentArray: true,
            pathEnd: 'message',
            entryType: 'object',
        },
        'message.speech': {
            isParentArray: true,
            pathEnd: 'message',
            entryType: 'object',
        },
        'reprompt': {
            isParentArray: true,
            pathEnd: 'reprompt',
            entryType: 'string',
        },
        'reprompt.text': {
            isParentArray: true,
            pathEnd: 'reprompt',
            entryType: 'object',
        },
        'reprompt.speech': {
            isParentArray: true,
            pathEnd: 'reprompt',
            entryType: 'object',
        },
        'listen': {
            isParentArray: true,
            pathEnd: 'listen',
            entryType: 'boolean',
        },
        'quickReplies': {
            isParentArray: true,
            pathEnd: 'quickReplies',
            entryType: 'string',
        },
        'quickReplies.text': {
            isParentArray: true,
            pathEnd: 'quickReplies',
            entryType: 'object',
        },
        'quickReplies.value': {
            isParentArray: true,
            pathEnd: 'quickReplies',
            entryType: 'object',
        },
    };

    if (pathType && configMap[pathType]) {
        return configMap[pathType];
    }

    return {
        isParentArray: false,
        pathEnd: pathType,
        entryType: 'string',
    }

}

async function convertSheetToInvocationNameJSON(sheet, locale) {
    let names = {};

    const rows = await sheet.getRows();

    for (const row of rows) {
        const key = row.environment || row.stage;
        if (key) {
            _.set(names, `${key}.${locale}.invocation`, row.invocationName);
        }
    }

    return names;
}

async function buildJovoModel(args, intentSheets, utteranceSheets, slotSheets) {
    const model = { invocation: 'replace me' };
    const utterances = await getAllUtterances(utteranceSheets);
    await getIntents(model, intentSheets, args, utterances);
    model.inputTypes = await getInputTypes(slotSheets);

    return model;
}

async function buildJovoModel4(args, intentSheets, utteranceSheets, slotSheets) {
    let model = jovoModelHelper.new('replace me');
    const utterances = await getAllUtterances(utteranceSheets);
    await getIntents4(model, intentSheets, args, utterances);
    const inputTypes = await getInputTypes(slotSheets);
    model.entityTypes = reduceToMap('name', inputTypes);

    return model;
}

module.exports = {
    convertSheetToJSON,
    convertSheetToTranslationJSON,
    convertSheetToV4TranslationJSON,
    convertSheetToInvocationNameJSON,
    buildJovoModel,
    buildJovoModel4,
}

async function getIntents(json, intentSheets, args, utterances) {
    if (!json.intents) {
        json.intents = [];
    }
    
    for (const sheet of intentSheets) {
        const rows = await sheet.getRows();
        let prevIntentName;

        for (const row of rows) {
            if (row.intentName) {
                prevIntentName = row.intentName;
            }
            const intentName = row.intentName || prevIntentName;

            // platform-specific intent
            if (row.platformIntent) {
                if (row.platformIntent === 'alexa') {
                    if (!json.alexa) {
                        _.set(json, 'alexa.interactionModel.languageModel.intents', []);
                    }

                    const alexaIntent = {
                        name: intentName,
                        samples: utterances[intentName] || [],
                    };

                    json.alexa.interactionModel.languageModel.intents.push(alexaIntent);
                }

                if (row.platformIntent === 'dialogflow') {
                    if (!json.dialogflow) {
                        _.set(json, 'dialogflow.intents', []);
                    }

                    if (row.intentModifier) {
                        if (row.intentModifier === 'FALLBACK') {
                            const dialogflowIntent = {
                                name: intentName,
                                auto: true,
                                webhookUsed: true,
                                fallbackIntent: true
                            }

                            json.dialogflow.intents.push(dialogflowIntent);
                        } else {
                            const dialogflowIntent = {
                                name: intentName,
                                auto: true,
                                webhookUsed: true,
                                events: [{ name: row.intentModifier }]
                            }
                            json.dialogflow.intents.push(dialogflowIntent);
                        }
                    }
                }

                if (row.platformIntent === 'googleAssistant') {
                    if (!_.get(json, 'googleAssistant.custom.global')) {
                        _.set(json, 'googleAssistant.custom.global', {});
                    }

                    json.googleAssistant.custom.global[intentName] = {
                        "handler": {
                            "webhookHandler": "Jovo"
                        }
                    }

                }

                continue;
            }



            // general intent
            let intent = _.find(json.intents, { name: intentName });
            if (!intent) {
                // add intent
                intent = {
                    name: intentName,
                    phrases: utterances[intentName] || [],
                    inputs: [],
                };

                json.intents.push(intent);
            }

            if (row.intentModifier) {
                const [platform, name] = row.intentModifier.split(':');

                if (platform === 'alexa') {
                    intent[platform] = { name };
                }

                if (platform === 'dialogflow') {
                    intent[platform] = {
                        webhookUsed: true,
                        events: [{ name }]
                    };
                }
            }

            if (row.slotName && row.slotType) {
                let input = _.find(intent.inputs, { name: row.slotName });
                if (!input) {
                    input = {
                        name: row.slotName,
                        type: {},
                    }

                    intent.inputs.push(input);
                }

                const [platform, value] = row.slotType.split(':');
                if (platform && value) {
                    input.type[platform] = value;
                } else {
                    input.type = row.slotType
                }

                if (row.slotType === 'googleAssistant:ANY_TYPE') {
                    _.set(json, 'googleAssistant.custom.types',
                        {
                            "ANY_TYPE": {
                                "freeText": {}
                            }
                        }
                    );
                }

            }

        }
    }

    return json;
}

async function getAllUtterances(utteranceSheets) {
    const utterances = {};

    for (const sheet of utteranceSheets) {
        const rows = await sheet.getRows();

        for (const header of sheet.headerValues) {
            if (!utterances[header]) {
                utterances[header] = [];
            }

            for (const row of rows) {
                const utterance = row[header] || '';
                const formatted = utterance
                    .replace(/“/g, '"')
                    .replace(/”/g, '"')
                    .replace(/&/g, 'and')
                    .replace(/’/g, "'")
                    .replace(/’/g, "'")
                    .replace(/[^0-9a-z {'}]/gi, '')
                    .trim();

                if (formatted) {
                    utterances[header].push(formatted);
                }

            }
        }
    }

    return utterances;
}

async function getInputTypes(slotWorksheets) {
    const worksheetPromises = slotWorksheets
        .map((sheet) => sheet.getRows()
            .then((rows) => {
                let prevValue;
                const values = rows.reduce((list, row) => {
                    if (row.value) {
                        prevValue = row.value;
                    }
                    const value = row.value || prevValue;
                    if (value) {
                        const index = _.findIndex(list, { value })
                        if (index > -1) {
                            // existing value
                            if (row.synonym) {
                                list[index].synonyms.push(row.synonym)
                            }
                        } else {
                            // new value
                            let item = { value };

                            if (row.id) {
                                item.id = row.id;
                            }

                            if (row.synonym) {
                                item.synonyms = [row.synonym];
                            }

                            list.push(item);
                        }

                        return list;
                    }

                }, []);

                return {
                    name: _.replace(sheet.title, 'SLOT_', ''),
                    values
                };
            }))

    return Promise.all(worksheetPromises);
}


async function getIntents4(model, intentSheets, args, utterances) {
    for (const sheet of intentSheets) {
        const rows = await sheet.getRows();
        let prevIntentName;

        for (const row of rows) {
            if (row.intentName) {
                prevIntentName = row.intentName;
            }
            const intentName = row.intentName || prevIntentName;

            // platform-specific intent
            if (row.platformIntent) {
                if (row.platformIntent === 'alexa') {
                    if (!model.alexa) {
                        _.set(model, 'alexa.interactionModel.languageModel.intents', []);
                    }

                    const alexaIntent = {
                        name: intentName,
                        samples: utterances[intentName] || [],
                    };

                    model.alexa.interactionModel.languageModel.intents.push(alexaIntent);
                }

                if (row.platformIntent === 'dialogflow') {
                    if (!model.dialogflow) {
                        _.set(model, 'dialogflow.intents', []);
                    }

                    if (row.intentModifier) {
                        if (row.intentModifier === 'FALLBACK') {
                            const dialogflowIntent = {
                                name: intentName,
                                auto: true,
                                webhookUsed: true,
                                fallbackIntent: true
                            }

                            model.dialogflow.intents.push(dialogflowIntent);
                        } else {
                            const dialogflowIntent = {
                                name: intentName,
                                auto: true,
                                webhookUsed: true,
                                events: [{ name: row.intentModifier }]
                            }
                            model.dialogflow.intents.push(dialogflowIntent);
                        }
                    }
                }

                if (row.platformIntent === 'googleAssistant') {
                    if (!_.get(model, 'googleAssistant.custom.global')) {
                        _.set(model, 'googleAssistant.custom.global', {});
                    }

                    model.googleAssistant.custom.global[intentName] = {
                        "handler": {
                            "webhookHandler": "Jovo"
                        }
                    }

                }

                continue;
            }

            // general intents
            jovoModelHelper.addIntent(model, intentName, { phrases: utterances[intentName] || []});

            if (row.intentModifier) {
                const [platform, name] = row.intentModifier.split(':');
                const intent = jovoModelHelper.getIntentByName(model, intentName);

                if (platform === 'alexa') {
                    intent[platform] = { name };
                }

                if (platform === 'dialogflow') {
                    intent[platform] = {
                        webhookUsed: true,
                        events: [{ name }]
                    };
                }
            }

            if (row.slotName && row.slotType) {
                jovoModelHelper.addEntity(model, intentName, row.slotName, {type: {}})

                const entity = jovoModelHelper.getEntityByName(model, intentName, row.slotName);

                const [platform, value] = row.slotType.split(':');
                if (platform && value) {
                    entity.type[platform] = value;
                } else {
                    entity.type = row.slotType;
                }

                if (row.slotType === 'googleAssistant:ANY_TYPE') {
                    _.set(model, 'googleAssistant.custom.types',
                        {
                            "ANY_TYPE": {
                                "freeText": {}
                            }
                        }
                    );
                }

            }

        }
    }
}

function reduceToMap(key, arr) {
    return arr.reduce((returnMap, el) => {
        returnMap[el[key]] = el;
        return returnMap;
    }, {});
}