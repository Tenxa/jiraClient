const helpers = require('./helperFunctions')
const storiesWithThemaAndEpic = require('./storiesWithThemaAndEpic')


const deliveryTimeForDones = async (key) => {
	const stories = await storiesWithThemaAndEpic.storiesWithThemaAndEpic()
	const filterEpic = stories.filter(epic => epic.epic == key)

	const storiesInEpic = filterEpic.map(epic => epic.stories).flat()
	const logs = await (await helpers.changeLogsByIdArrayV2(storiesInEpic.map(s => s.key))).flat()
	const logCreatedAndItems = logs.map(log => {
		return {
			key: log.issueId, data: log.values.map(value => {
				return { created: value.created, items: value.items }
			})
		}
	})

	// Get Dates for tickets status change
	const inProg = []
	const done = []
	logCreatedAndItems.forEach(log => log.data.forEach(d => d.items.forEach(i => {
		// Gets the first In progress date as sometimes it goes from in Prog -> in review -> in Prog...
		if (i.field == "status" && i.toString == "In Progress") {
			if (inProg.filter(inP => inP.key == log.key).length <= 0) {
				inProg.push({ key: log.key, created: d.created, status: i.toString })
			}
		}
		if (i.field == "resolution" && i.toString == "Done") {
			done.push({ key: log.key, created: d.created, status: i.toString })
		}
	})))

	// filter out all tickets in inProg that has not been done
	// if we process an epic that has not been completed, we can see the delivery time of done tickets.
	inProg.filter(inp => {
		for (let i = 0; i < done; i++) {
			return inp.key == done[i].key ? true : false
		}
	})

	const doneMax = new Date(Math.max(...done.map(d => new Date(d.created))))
	const inProgMin = new Date(Math.min(...inProg.map(i => new Date(i.created))))

	const result = helpers.getDaysBetweenDates(doneMax, inProgMin)

	return result
}

module.exports = { deliveryTimeForDones }