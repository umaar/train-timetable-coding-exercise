/* global $, window */
import mustache from './vendor/mustache.mjs';
import journeyModel from './journey-model.js';

function getTemplate(path) {
	return window.fetch(path).then(response => response.text());
}

async function serve() {
	const journeys = await journeyModel.getJourneys();
	console.log(journeys);
	const template = await getTemplate('templates/journeys.mustache');
	const markup = mustache.render(template, {journeys});
	$('.journeys').append(markup);
}

async function journeyDetailView() {
	const journeyElement = $(this);
	const order = journeyElement.data('order');
	const template = await getTemplate('templates/journeyDetails.mustache');
	const journey = await journeyModel.getJourneyDetails(order);
	const duration = journeyModel.getJourneyDuration(journey);
	const templateData = Object.assign({}, journey, {duration});
	const markup = mustache.render(template, templateData);
	journeyElement.find('.journey-details').remove();
	journeyElement.append(markup);
	journeyElement.toggleClass('active');
}

function attachJourneyDetailListener() {
	$('.journeys').on('click', '.journey-route', journeyDetailView);
}

function init() {
	serve();
	attachJourneyDetailListener();
}

export default {init};
