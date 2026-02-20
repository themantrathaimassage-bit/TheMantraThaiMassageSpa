import React from 'react';
import { FiMapPin } from 'react-icons/fi';
import ServiceDescriptionModal from './ServiceDescriptionModal';
import styles from './AboutSection.module.css';

const AboutSection = ({ venue }) => {
    const [showModal, setShowModal] = React.useState(false);
    const description = venue.description || '';

    return (
        <>
            <div id="about-section" className={styles.container} style={{ scrollMarginTop: '140px' }}>
                <div className={styles.card} onClick={() => setShowModal(true)}>
                    <div className={styles.mainInfo}>
                        <div className={styles.header}>
                            <h2 className={styles.title}>About {venue.name}</h2>
                        </div>
                        <div className={styles.descriptionWrapper}>
                            <p className={styles.description}>
                                {description}
                            </p>
                            <span className={styles.moreLink}>read more</span>
                        </div>
                    </div>
                </div>

                <div className={styles.mapContainer}>
                    <div className={styles.mapFrame}>
                        <iframe
                            width="100%"
                            height="300"
                            frameBorder="0"
                            scrolling="no"
                            marginHeight="0"
                            marginWidth="0"
                            style={{ borderRadius: '12px' }}
                            src="https://maps.google.com/maps?width=100%25&amp;height=300&amp;hl=en&amp;q=133%20Marrickville%20Rd,%20Marrickville%20NSW%202204+(The%20Mantra%20Thai%20Massage)&amp;t=&amp;z=15&amp;ie=UTF8&amp;iwloc=B&amp;output=embed">
                        </iframe>
                    </div>
                    <div className={styles.address}>
                        <FiMapPin className={styles.pinIcon} />
                        <span>{venue.address}</span>
                    </div>
                </div>

                <div id="opening-hours" className={styles.hours} style={{ scrollMarginTop: '140px' }}>
                    <h3 className={styles.subtitle}>Opening hours</h3>
                    <ul className={styles.hoursList}>
                        {venue.openingHours.map((item, index) => {
                            const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                            const isToday = item.day === currentDayName;

                            return (
                                <li key={index} className={`${styles.hourItem} ${isToday ? styles.currentDay : ''}`}>
                                    <span className={`${styles.day} ${isToday ? styles.bold : ''}`}>{item.day}</span>
                                    <span className={`${styles.time} ${isToday ? styles.bold : ''}`}>{item.hours}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>

            {showModal && (
                <ServiceDescriptionModal
                    service={{
                        name: "About " + venue.name,
                        description: description,
                        duration: venue.location,
                        price: venue.rating + " ⭐"
                    }}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
};

export default AboutSection;
