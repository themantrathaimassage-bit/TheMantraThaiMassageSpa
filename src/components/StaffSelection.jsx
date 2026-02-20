import React from 'react';
import { FiUser } from 'react-icons/fi';
import styles from './StaffSelection.module.css';

const StaffSelection = ({ staffMembers, onSelect, guestName, selectedStaffId }) => {
    // Local state for immediate feedback and to ensure the UI updates/resets correctly
    const [clickedId, setClickedId] = React.useState(selectedStaffId);

    // Sync or reset when the prop changes (e.g., when the guest changes)
    React.useEffect(() => {
        setClickedId(selectedStaffId);
    }, [selectedStaffId]);

    const handleInternalSelect = (staff) => {
        setClickedId(staff.id);
        onSelect(staff);
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>
                Select professional for <span className={styles.activeGuestName}>{guestName}</span>
            </h2>
            <div className={styles.list}>
                {staffMembers.map((staff) => {
                    const isActive = clickedId === staff.id;
                    return (
                        <div
                            key={staff.id}
                            className={`${styles.card} ${isActive ? styles.activeCard : ''}`}
                            onClick={() => handleInternalSelect(staff)}
                        >
                            <div className={styles.avatar}>
                                {staff.image ? (
                                    <img src={staff.image} alt={staff.name} className={styles.image} />
                                ) : (
                                    <div className={styles.placeholder}>
                                        <FiUser />
                                    </div>
                                )}
                            </div>
                            <div className={styles.info}>
                                <h3 className={styles.name}>{staff.name}</h3>
                            </div>
                            <div className={styles.radio}>
                                <div className={styles.radioInner}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StaffSelection;
