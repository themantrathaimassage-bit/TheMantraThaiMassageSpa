import React, { useState, useEffect, useCallback, memo } from 'react';
import { FiPhone } from 'react-icons/fi';
import HeroSection from '../components/HeroSection';
import { venueData } from '../data/venueData';
import ServiceList from '../components/ServiceList';
import { servicesData } from '../data/servicesData';
import { fetchSquareServices } from '../data/squareCatalog';
import AboutSection from '../components/AboutSection';
import ReviewsSection from '../components/ReviewsSection';
import { reviewsData } from '../data/reviewsData';
import StickyBookingCard from '../components/StickyBookingCard';
import styles from './VenuePage.module.css';

import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const VenuePage = () => {
    const [venue, setVenue] = useState(venueData);
    const [services, setServices] = useState(servicesData);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [reviews, setReviews] = useState(reviewsData);
    const [showMaintenance, setShowMaintenance] = useState(false);
    const isMaintenanceMode = true;

    const { addService, selectedServices } = useCart();
    const navigate = useNavigate();

    // Data Fetching with AbortController for cleanup
    useEffect(() => {
        const controller = new AbortController();
        setServicesLoading(true);

        // Fetch Services
        fetchSquareServices().then(live => {
            if (!controller.signal.aborted && live?.length > 0) setServices(live);
            setServicesLoading(false);
        }).catch(() => {
            if (!controller.signal.aborted) setServicesLoading(false);
        });

        // Fetch Location Info (Opening Hours only, to prevent overwriting address with Bowral)
        import('../data/squareCatalog').then(m => m.fetchSquareLocation()).then(liveLoc => {
            if (!controller.signal.aborted && liveLoc) {
                // Keep manual opening hours for now as requested
                // setVenue(prev => ({ ...prev, openingHours: liveLoc.openingHours || prev.openingHours }));
            }
        });

        // Fetch Reviews
        fetch('/api/reviews', { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                if (controller.signal.aborted) return;

                const list = Array.isArray(data) ? data : (data?.reviews || []);
                if (list.length > 0) setReviews(list);

                if (data?.rating) {
                    setVenue(prev => ({
                        ...prev,
                        rating: data.rating,
                        reviewCount: data.user_ratings_total
                    }));
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') console.error('Fetch reviews error:', err);
            });

        return () => controller.abort();
    }, []);

    const handleServiceSelect = useCallback((service) => {
        if (isMaintenanceMode) {
            setShowMaintenance(true);
            return;
        }
        addService(service);
        navigate('/booking');
    }, [addService, navigate]);

    return (
        <div className={styles.pageContainer}>
            <HeroSection venue={venue} />

            <div className={styles.contentGrid}>
                <main className={styles.mainContent}>
                    <section className={styles.sectionWrapper}>
                        <div id="services" style={{ scrollMarginTop: '140px' }}>
                            <ServiceList
                                services={services}
                                onServiceSelect={handleServiceSelect}
                                isSearching={false}
                                isLoading={servicesLoading}
                                buttonText="Book"
                                selectedIds={selectedServices.map(s => s.id)}
                            />
                        </div>
                    </section>

                    <hr className={styles.divider} />

                    <section className={styles.sectionWrapper}>
                        <div id="location" style={{ scrollMarginTop: '140px' }}>
                            <AboutSection venue={venue} />
                        </div>
                    </section>

                    <hr className={styles.divider} />

                    <section className={styles.sectionWrapper}>
                        <div id="reviews" style={{ scrollMarginTop: '140px' }}>
                            <ReviewsSection
                                reviews={reviews}
                                rating={venue.rating}
                                reviewCount={venue.reviewCount}
                            />
                        </div>
                    </section>
                </main>

                <aside className={styles.sidebar}>
                    <StickyBookingCard venue={venue} />
                </aside>
            </div>

            {showMaintenance && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'white', borderRadius: 32, padding: '48px 32px', maxWidth: 480, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>
                        <div style={{ width: 80, height: 80, background: '#fff7ed', color: '#f97316', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                            <FiPhone size={40} />
                        </div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.2, margin: '16px 0 8px 0' }}>Almost there!</h1>
                        <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                            Our online system is temporarily paused for updates until <strong>June</strong>.
                        </p>
                        <div style={{ margin: '8px 0', textAlign: 'center' }}>
                            <p style={{ fontSize: 16, color: '#64748b', margin: 0 }}>Please call us to confirm your selected time:</p>
                        </div>
                        <a href="tel:0493853415" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', padding: '16px 32px', boxSizing: 'border-box', background: '#1a1a1a', color: 'white', borderRadius: 100, textDecoration: 'none', fontWeight: 700, fontSize: 16, marginTop: 12 }}>
                            <FiPhone size={20} />
                            <span>Call 0493 853 415</span>
                        </a>
                        <button 
                            onClick={() => setShowMaintenance(false)} 
                            style={{ marginTop: '16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Back to Menu
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(VenuePage);
