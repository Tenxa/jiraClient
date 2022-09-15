const createSipParallel = require('./createSipParallel')
const helpers = require('./helperFunctions')


const monteCarloSimulation = async (size) => {
  const issueSize = size
  const sip = await createSipParallel.createSipParallel()
  const simulationRounds = 10000
  const randomElement = () => {
    return sip[Math.floor(Math.random() * sip.length)]
  }
  const results = new Map()

  // results: { deliveryTime: 572, averageTaktTime: 28.6 }...
  for (let i = 0; i < simulationRounds; i++) {
    const resampledArray = []
    for (let j = 0; j < issueSize; j++) {
      resampledArray.push(randomElement())
    }

    const deliveryTime = resampledArray.reduce((previous, current) => previous + current, 0)
    const averageTaktTime = deliveryTime / resampledArray.length
    results.set(i + 1, { deliveryTime, averageTaktTime })
  }

  const ttArray = [...results.values()].map(v => v.averageTaktTime)
  const dtArray = [...results.values()].map(v => v.deliveryTime)


  // Function can be used in response etc to round values.
  // const round2Decimals = Math.round((ttOrDt + Number.EPSILON) * 100) / 100 factTable([...results.values()], "averageTaktTime"),

  return ({
    TaktTimes: { DeviationTableTT: helpers.factTableDeviation(ttArray, simulationRounds), FactTableTT_days: helpers.factTable([...results.values()], "averageTaktTime", simulationRounds) },
    DeliveryTime: { DeviationTableT: helpers.factTableDeviation(dtArray, simulationRounds), FactTableT_days: helpers.factTable([...results.values()], "deliveryTime", simulationRounds) }
  })
}

module.exports = {
  monteCarloSimulation
}