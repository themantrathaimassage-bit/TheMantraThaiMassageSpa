import React from 'react';
import { FiPlus, FiX } from 'react-icons/fi';
import styles from './GuestSelector.module.css';

const GuestSelector = ({ guests, activeGuestId, onSwitchGuest, onAddGuest, onRemoveGuest }) => {
    return (
        <div className={styles.container}>
            <div className={`${styles.tabs} ${guests.length > 2 ? styles.carouselMode : ''}`}>
                {guests.map((guest, index) => (
                    <button
                        key={guest.id}
                        className={`${styles.tab} ${activeGuestId === guest.id ? styles.activeTab : ''}`}
                        onClick={() => onSwitchGuest(guest.id)}
                    >
                        <div className={styles.tabContent}>
                            <span className={styles.name}>{guest.name}</span>
                            {guest.time && (
                                <span className={styles.timeSummary}>
                                    {guest.time.time} · {guest.time.date.dayNum} {guest.time.date.month}
                                </span>
                            )}
                        </div>
                        {index > 0 && (
                            <div
                                className={styles.removeBtn}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveGuest(guest.id);
                                }}
                            >
                                <FiX size={14} />
                            </div>
                        )}
                    </button>
                ))}
                <button className={styles.addBtn} onClick={onAddGuest}>
                    <FiPlus size={16} />
                    Add guest
                </button>
            </div>
        </div>
    );
};

export default GuestSelector;
