const storiesWithThemaAndEpic = require('./storiesWithThemaAndEpic')
const mongooseQueries = require('./mongooseQueries')
const helpers = require('./helperFunctions')

const createSip = async () => {
	// Check Time between in progress -> done OR To Do -> Done but time = 0 in the latter case.
	const epics = await storiesWithThemaAndEpic.storiesWithThemaAndEpic()
	// REMOVE LATER: Slice for testing .slice(0, 20) 
	const epicsWithIssues = epics.filter(epic => epic.stories.length > 0)

	const mapStories = epicsWithIssues.map(async (epic) => {
		const cfdsForEpic = await mongooseQueries.cfdByEpic(epic.epic)
		return [...cfdsForEpic]
	})

	const resolveCfds = await Promise.all(mapStories)
	const filterEmpties = resolveCfds.filter(cfds => cfds.length > 0)
	const sortByDate = filterEmpties.map(epic => epic.sort((a, b) => a.time - b.time))


	// inProgchanges is a Map with epic as key and array of changes in numberOfIssues as value. 
	const inProgChanges = helpers.getStatusIssueChanges(sortByDate.map(epic => epic.filter(cfd => cfd.status === 'In Progress')))
	const doneChanges = helpers.getStatusIssueChanges(sortByDate.map(epic => epic.filter(cfd => cfd.status === 'Done')))
	const todoChanges = helpers.getStatusIssueChanges(sortByDate.map(epic => epic.filter(cfd => cfd.status === 'To Do')))


	const taktTimes = []
	for (const key of doneChanges.keys()) {
		let dones = helpers.getIssueStatusTimes(doneChanges.get(key))
		let inProgs = helpers.getIssueStatusTimes(inProgChanges.get(key))
		let todos = helpers.getIssueStatusTimes(todoChanges.get(key))

		if (dones === undefined || inProgs === undefined || todos === undefined) continue

		// TODO: How to take in consideration tickets that are made in parallel.
		// Notes: tickets are sorted by date (start) at this point, so we'll inspect the previous ticket and see if the current ticket is done on the same day as the previous.
		//        There is uncertainty in our approach as we dont look per ticket the status process. Just looking kind of randomly at status changes and their dates.
		//        The most simple situation is when ticket have same "start" and Done date.
		for (let i = 0; i < dones.length; i++) {
			for (let j = 0; j < dones[i].numberOfIssues; j++) {
				// if done.time is earlier than the next inProg then it has to be taken from done -> todo. Same if inProgs are empty.
				// if both todo and inProgress are in the future then taktTime for the ticket = 0
				if (todos.length > 0 && (inProgs.length == 0 || inProgs[0].time > dones[i].time)) {
					if (todos[0].time > dones[i].time) {
						taktTimes.push(0)
					} else {
						taktTimes.push(helpers.getDaysBetweenDates(dones[i].time, todos[0].time))
					}
				} else {
					taktTimes.push(helpers.getDaysBetweenDates(dones[i].time, inProgs[0].time))
					inProgs[0].numberOfIssues--
				}

				if (todos.length > 0 && todos[0].time < dones[i].time) {
					todos[0].numberOfIssues--
					if (todos[0].numberOfIssues === 0) { todos.shift() }
				}
				if (inProgs.length > 0) {
					if (inProgs[0].numberOfIssues === 0) { inProgs.shift() }
				}
			}
		}
	}

	//console.log(taktTimes)
	return taktTimes
}

module.exports = { createSip }