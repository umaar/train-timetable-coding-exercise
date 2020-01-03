function fetchData(file) {
	return window.fetch(file).then(response => response.json());
}

async function getJourneys() {
	const allJourneys = await fetchData('data/journeysWithPrices.json');
	return allJourneys.sort((a, b) => {
		if (a.order < b.order) {
			return -1;
		}

		if (a.order > b.order) {
			return 1;
		}

		return 0;
	});
}

async function getJourneyDetails(desiredOrder) {
	const allJourneys = await fetchData('data/journeysWithPrices.json');
	return allJourneys.find(({order}) => order === desiredOrder);
}

function getDateObject(time) {
	const [hours, minutes, seconds] = time.split(':');
	const dateObject = new Date();
	dateObject.setHours(hours);
	dateObject.setMinutes(minutes);
	dateObject.setSeconds(seconds);
	return dateObject;
}

function getJourneyDuration({startTime, arrivalTime}) {
	const start = getDateObject(startTime);
	const end = getDateObject(arrivalTime);
	return Math.floor(((end - start) / 1000) / 60);
}

export default {getJourneys, getJourneyDetails, getJourneyDuration};
