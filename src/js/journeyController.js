import journeyModel from './journeyModel';
import Mustache from 'mustache';

function getTemplate(path) {
	return fetch(path).then(response => response.text());
}

async function serve() {
	const journeys = await journeyModel.getJourneys();
	const template = await getTemplate('templates/journeys.mustache');
	const markup = Mustache.render(template, {journeys});
	$('.journeys').append(markup);
}

async function journeyDetailView() {
	const journeyEl = $(this);
	const order = journeyEl.data('order');
	const template = await getTemplate('templates/journeyDetails.mustache');
	const journey = await journeyModel.getJourneyDetails(order);
	const duration = journeyModel.getJourneyDuration(journey);
	const templateData = Object.assign({}, journey, {duration});
	const markup = Mustache.render(template, templateData);
	journeyEl.find('.journey-details').remove();
	journeyEl.append(markup);
	journeyEl.toggleClass('active');
}

function attachJourneyDetailListener() {
	$('.journeys').on('click', 'li', journeyDetailView)
}

function init() {
	serve();
	attachJourneyDetailListener();
}

export default {init};