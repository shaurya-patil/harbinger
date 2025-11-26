const ical = require('ical-generator').default;

try {
    console.log('Type of ical:', typeof ical);
    const calendar = ical({ name: 'Meeting' });
    console.log('Calendar created');

    calendar.createEvent({
        start: new Date(),
        end: new Date(Date.now() + 3600000),
        summary: 'Test Event',
        description: 'Test Description',
        location: 'Test Location'
    });

    console.log('Event created');
    console.log('ICS Content:');
    console.log(calendar.toString());
} catch (error) {
    console.error('Error:', error);
}
