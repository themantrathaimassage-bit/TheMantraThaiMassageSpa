import React from 'react';
import { FiPlus } from 'react-icons/fi';
import styles from './ServiceItem.module.css';

const ServiceItem = ({ service, onAdd }) => {
    const isAddon = service.isAddon;

    return (
        <div className={`${styles.container} ${isAddon ? styles.addonContainer : ''}`}>
            <div className={styles.info}>
                <div className={styles.nameRow}>
                    <h3 className={styles.name}>{service.name}</h3>
                    {isAddon && <span className={styles.addonBadge}>Add-on</span>}
                </div>
                <div className={styles.meta}>
                    {service.duration && service.duration !== 'Add-on' && (
                        <span className={styles.duration}>{service.duration}</span>
                    )}
                    <span className={styles.price}>
                        {isAddon ? `+$${service.price}` : `$${service.price}`}
                    </span>
                </div>
            </div>
            <button className={`${styles.bookButton} ${isAddon ? styles.addonButton : ''}`} onClick={() => onAdd(service)}>
                Add
            </button>
        </div>
    );
};

export default ServiceItem;
