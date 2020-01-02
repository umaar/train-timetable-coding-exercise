import 'fetch'; //polyfill for fetch()

function fetchData(file) {
	return fetch(file).then(response => response.json());
}

async function getJourneys() {
	const allJourneys = await fetchData('data/journeysWithPrices.json');
	return allJourneys.sort((a, b) => {
		if (a.order < b.order) return -1;
		if (a.order > b.order) return 1;
		return 0;
	});
}

async function getJourneyDetails(desiredOrder) {
	const allJourneys = await fetchData('data/journeysWithPrices.json');
	return allJourneys.find(({order}) => order === desiredOrder);
}

function getDateObj(time) {
	const [hours, minutes, seconds] = time.split(':');
	const dateObj = new Date();
	dateObj.setHours(hours);
	dateObj.setMinutes(minutes);
	dateObj.setSeconds(seconds);
	return dateObj;
}

function getJourneyDuration({startTime, arrivalTime}) {
	const start = getDateObj(startTime);
	const end = getDateObj(arrivalTime);
	return Math.floor(((end - start) / 1000) / 60);
}

export default {getJourneys, getJourneyDetails, getJourneyDuration};