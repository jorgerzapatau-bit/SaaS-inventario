"use client";

import { useState, useRef, useEffect } from 'react';

interface Props {
    text: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export function InfoTooltip({ text, position = 'top' }: Props) {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);
    const tipRef = useRef<HTMLDivElement>(null);

    const show = () => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        let top = 0, left = 0;
        if (position === 'top') {
            top = rect.top + scrollY - 8;
            left = rect.left + scrollX + rect.width / 2;
        } else if (position === 'bottom') {
            top = rect.bottom + scrollY + 8;
            left = rect.left + scrollX + rect.width / 2;
        } else if (position === 'right') {
            top = rect.top + scrollY + rect.height / 2;
            left = rect.right + scrollX + 8;
        } else {
            top = rect.top + scrollY + rect.height / 2;
            left = rect.left + scrollX - 8;
        }
        setCoords({ top, left });
        setVisible(true);
    };

    // Close on outside click or scroll
    useEffect(() => {
        if (!visible) return;
        const close = () => setVisible(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('click', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('click', close);
        };
    }, [visible]);

    const positionStyle = (): React.CSSProperties => {
        if (position === 'top') return {
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: 'translate(-50%, -100%)',
            marginTop: -6,
        };
        if (position === 'bottom') return {
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: 'translateX(-50%)',
        };
        if (position === 'right') return {
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: 'translateY(-50%)',
        };
        return {
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: 'translate(-100%, -50%)',
            marginLeft: -6,
        };
    };

    const arrowStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: 'absolute',
            width: 0, height: 0,
        };
        if (position === 'top') return { ...base, bottom: -5, left: '50%', transform: 'translateX(-50%)', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1e293b' };
        if (position === 'bottom') return { ...base, top: -5, left: '50%', transform: 'translateX(-50%)', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid #1e293b' };
        if (position === 'right') return { ...base, left: -5, top: '50%', transform: 'translateY(-50%)', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '5px solid #1e293b' };
        return { ...base, right: -5, top: '50%', transform: 'translateY(-50%)', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid #1e293b' };
    };

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onMouseEnter={show}
                onMouseLeave={() => setVisible(false)}
                onClick={e => { e.stopPropagation(); setVisible(v => !v); }}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors flex-shrink-0 cursor-help"
                style={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}
            >
                ?
            </button>

            {visible && (
                <div
                    ref={tipRef}
                    style={{
                        ...positionStyle(),
                        zIndex: 9999,
                        maxWidth: 260,
                        background: '#1e293b',
                        color: 'white',
                        fontSize: 11,
                        lineHeight: 1.5,
                        padding: '7px 10px',
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        pointerEvents: 'none',
                        whiteSpace: 'normal',
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {text}
                    <div style={arrowStyle()} />
                </div>
            )}
        </>
    );
}
