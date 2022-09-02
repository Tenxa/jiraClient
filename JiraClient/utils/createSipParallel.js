const helpers = require('./helperFunctions')
const storiesWithThemaAndEpic = require('./storiesWithThemaAndEpic')
const mongooseQueries = require('./mongooseQueries')

const createSipParallel = async () => {
	const epics = await storiesWithThemaAndEpic.storiesWithThemaAndEpic()
	const epicsWithIssues = epics.filter(epic => epic.stories.length > 0)
	const epicsWithDones = epicsWithIssues.filter(epic => epic.storyStatusesCount.done > 0)

	const logsForDones = epicsWithDones.map(async (epic) => {
		const mapDone = epic.stories.map(async (story) => {
			if (story.status === "Done") {
				const log = await mongooseQueries.changelogByIssueId(story.key)
				if (log != null && log != undefined && log) {
					return log
				}
			}
		})
		return { epic: epic.epic, stories: (await Promise.all(mapDone)).filter(m => m != null) }
	})
	const resolvedLogs = await Promise.all(logsForDones)
	const filteredLogs = resolvedLogs.map(r => {
		return { epic: r.epic, stories: r.stories.filter(s => s.length > 0).flat() }
	})

	const toInProgress = []
	const toDone = []
	const inProgToDone = new Map()
	// push created dates to their respective arrays above
	filteredLogs.forEach((epic) => epic.stories.forEach(story => {
		const issueId = story.issueId
		story.values.forEach(changeLog => changeLog.items.forEach(item => {
			// Get the first In progress date as sometimes it goes from in Prog -> in review -> in Prog...
			if (toInProgress.filter(ip => ip.issueId == issueId).length <= 0) {
				if (item.toString === "In Progress" && item.field === "status") { toInProgress.push({ issueId, epic: epic.epic, time: changeLog.created }) }
			}
			if (item.toString === "Done" && item.field === "resolution") { toDone.push({ issueId, epic: epic.epic, time: changeLog.created }) }
		}))
	}))

	toInProgress.sort((a, b) => a.time - b.time)
	toDone.sort((a, b) => a.time - b.time)
	// Find in progress tickets for dones and push to inProgToDone Map
	toDone.forEach(d => {
		if (!inProgToDone.has(d.epic)) { inProgToDone.set(d.epic, []) }
		toInProgress.forEach(ip => {
			if (d.issueId == ip.issueId && d.epic == ip.epic) { inProgToDone.get(d.epic).push({ done: d, inProgress: ip, taktTime: helpers.getDaysBetweenDates(d.time, ip.time) }) }
		})
	})


	// dates[] will be an array of arrays. Every array will represent an epic.
	// For checking parallely made tickets were looking for that only inside a single epic.
	const dates = []
	for (const key of inProgToDone.keys()) {
		const epicDates = []
		// Value for key -> []
		inProgToDone.get(key).forEach(t => {
			epicDates.push({ start: t.inProgress.time, end: t.done.time, tt: t.taktTime })
		})
		epicDates.sort((a, b) => b.tt - a.tt)
		dates.push(epicDates)
	}

	const checkIfDateInRange = (obj1, obj2) => {
		// obj2 has been started during obj1
		if (obj2.start >= obj1.start && obj2.start <= obj1.end) {
			// obj2 is done after obj1
			if (obj2.end >= obj1.end) {
				if (obj2.tt - helpers.getDaysBetweenDates(obj1.end, obj2.start) < 0) {
					obj2.tt = 0
				} else {
					obj2.tt = obj2.tt - helpers.getDaysBetweenDates(obj1.end, obj2.start)
				}
			}
			// obj2 is done before obj1
			if (obj2.end <= obj1.end) {
				obj2.tt = 0
			}
		}
	}

	dates.forEach((epic) => {
		for (let i = 0; i < epic.length; i++) {
			const prev = epic[i]
			for (let j = 1; j <= epic.length; j++) {
				if (i + j >= epic.length) { continue }
				const cur = epic[i + j]
				checkIfDateInRange(prev, cur)
			}
		}
	})

	return dates.map(e => e.map(t => t.tt)).flat().sort((a, b) => a - b)
}


module.exports = { createSipParallel }