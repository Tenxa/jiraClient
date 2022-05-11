const mongooseQueries = require('./mongooseQueries')
const helpers = require('./helperFunctions')


const dataInitLoop = async (array, epicOrFeature) => {
    const eOrFStoryArrayLength = (i) => {
        return epicOrFeature ? array[i].stories.length : array[i].storiesForFeatureBasic.length
    }
    const eOrFStory = (i, j) => {
        return epicOrFeature ? array[i].stories[j] : array[i].storiesForFeatureBasic[j]
    }

    const combinationObjectList = new Map()
    const today = new Date()

    for (let i = 0; i < array.length; i++) {
        for (let j = 0; j < eOrFStoryArrayLength(i); j++) {
            if (eOrFStory(i, j) === null || eOrFStory(i, j) === undefined) {
                continue
            }

            let basicTicket = epicOrFeature ?
                {
                    issueId: eOrFStory(i, j).key,
                    epic: null,
                    theme: array[i].theme,
                    project: eOrFStory(i, j).project,
                    time: eOrFStory(i, j).time,
                    issuetype: eOrFStory(i, j).issuetype,
                    status: 'To Do', //status is to do by default? until changed from changelogs
                } :
                {
                    issueId: eOrFStory(i, j).issueId,
                    feature: null,
                    businessProcess: array[i].toWhichBusinessProcess,
                    project: eOrFStory(i, j).project,
                    time: eOrFStory(i, j).time,
                    issuetype: eOrFStory(i, j).issuetype,
                    status: 'To Do',
                }

            const cl = await mongooseQueries.changelogByIssueId(eOrFStory(i, j).key)

            if (cl.length === 0) {
                if (epicOrFeature) {
                    basicTicket.epic = array[i].epic
                } else {
                    basicTicket.feature = array[i].featureName
                }
                let daysInBetween = helpers.getDaysBetweenDates(helpers.parseDateyyyymmdd(today), helpers.parseDateyyyymmdd(basicTicket.time))
                helpers.createCombinationObjects((daysInBetween + 1), basicTicket.time, basicTicket, combinationObjectList, epicOrFeature)
                continue
            }

            let prevValueDate = null
            for (let v = 0; v < cl[0].values.length; v++) {
                const value = cl[0].values[v]

                for (let z = 0; z < cl[0].values[v].items.length; z++) {
                    const item = cl[0].values[v].items[z]
                    if (epicOrFeature) {
                        if (!helpers.isPertientChangeEpic(item.field, basicTicket, item.toString, helpers.parseDateyyyymmdd(value.created))) {
                            continue
                        }
                    } else {
                        if (!helpers.isPertientChangeFeature(item.field, basicTicket, item.toString, helpers.parseDateyyyymmdd(value.created))) {
                            continue
                        }
                    }

                    let daysInBetween = helpers.getDaysBetweenDates(helpers.parseDateyyyymmdd(value.created), helpers.parseDateyyyymmdd(basicTicket.time))
                    const prevTime = prevValueDate ? prevValueDate : basicTicket.time

                    let ticketTime = new Date(prevTime)

                    helpers.createCombinationObjects((daysInBetween - 1), prevTime, basicTicket, combinationObjectList, epicOrFeature)
                    ticketTime.setDate(ticketTime.getDate() + daysInBetween)

                    prevValueDate = value.created
                    if (epicOrFeature) {
                        basicTicket = helpers.isPertientChangeEpic(item.field, basicTicket, item.toString, ticketTime)
                    } else {
                        basicTicket = helpers.isPertientChangeFeature(item.field, basicTicket, item.toString, ticketTime)
                    }

                    if (v === cl[0].values.length - 1 && z === cl[0].values[v].items.length - 1) {
                        daysInBetween = helpers.getDaysBetweenDates(helpers.parseDateyyyymmdd(today), helpers.parseDateyyyymmdd(prevValueDate))
                        helpers.createCombinationObjects((daysInBetween + 1), prevValueDate, basicTicket, combinationObjectList, epicOrFeature)
                    }
                }
            }
        }
    }

    const result = Array.from(combinationObjectList.entries()).map(value => value[1]).flat()
    return result
}

module.exports = {
    dataInitLoop
}