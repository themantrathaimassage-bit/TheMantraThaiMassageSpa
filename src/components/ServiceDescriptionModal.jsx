import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import styles from './ServiceDescriptionModal.module.css';

const ServiceDescriptionModal = ({ service, onClose }) => {
    // Prevent scrolling behind the modal
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    if (!service) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <FiX />
                </button>

                <div className={styles.header}>
                    <h2 className={styles.serviceName}>{service.name}</h2>
                    <div className={styles.metadata}>
                        <span>{service.duration}</span>
                        <span>•</span>
                        <span>${service.price}</span>
                    </div>
                </div>

                <div className={styles.description}>
                    {service.description || "No description available for this service."}
                </div>
            </div>
        </div>
    );
};

export default ServiceDescriptionModal;
