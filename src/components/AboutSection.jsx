import React from 'react';
import { FiMapPin } from 'react-icons/fi';
import styles from './AboutSection.module.css';

const AboutSection = ({ venue }) => {
    const getCurrentStatus = () => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = 9 * 60; // 9:00 AM
        const closeMinutes = 21 * 60; // 9:00 PM

        if (currentMinutes < openMinutes || currentMinutes >= closeMinutes) {
            return { isOpen: false, text: 'Closed' };
        }
        return { isOpen: true, text: 'Open now' };
    };

    const status = getCurrentStatus();

    return (
        <div id="location" className={styles.container}>
            <h2 className={styles.title}>Location</h2>

            <div className={styles.contentGrid}>
                <div className={styles.mapSide}>
                    <div className={styles.mapFrame}>
                        <iframe
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            scrolling="no"
                            marginHeight="0"
                            marginWidth="0"
                            style={{ border: 0 }}
                            src="https://maps.google.com/maps?width=100%25&amp;height=280&amp;hl=en&amp;q=133%20Marrickville%20Rd,%20Marrickville%20NSW%202204+(The%20Mantra%20Thai%20Massage)&amp;t=&amp;z=15&amp;ie=UTF8&amp;iwloc=B&amp;output=embed">
                        </iframe>
                    </div>
                    <div className={styles.addressRow}>
                        <div className={styles.addressInfo}>
                            <FiMapPin className={styles.pinIcon} size={16} />
                            <span>{venue.address}</span>
                        </div>
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venue.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.directionsLink}
                        >
                            Get Directions
                        </a>
                    </div>
                </div>

                <div id="opening-hours" className={styles.hoursSide}>
                    <div className={styles.hoursHeader}>
                        <h3 className={styles.subtitle}>Opening hours</h3>
                        <div className={status.isOpen ? styles.statusBadge : styles.statusBadgeClosed}>
                            <span className={status.isOpen ? styles.statusDot : styles.statusDotClosed}></span>
                            <span className={status.isOpen ? styles.statusText : styles.statusTextClosed}>{status.text}</span>
                        </div>
                    </div>
                    <div className={styles.hoursList}>
                        {venue.openingHours.map((item, index) => {
                            const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                            const isToday = item.day === currentDayName;
                            const isWeekend = item.day === 'Saturday' || item.day === 'Sunday';

                            return (
                                <div key={index} className={[
                                    styles.hourItem,
                                    isToday ? styles.isToday : '',
                                    isWeekend ? styles.isWeekend : ''
                                ].join(' ')}>
                                    <span className={styles.day}>{item.day}</span>
                                    <span className={styles.time}>9:00am - 9:00pm</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutSection;
