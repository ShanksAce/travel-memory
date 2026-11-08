'use client';

import { useId, useState, type ComponentPropsWithoutRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'type'> & {
    label: string;
    className?: string;
};

export default function PasswordField({ label, className, ...input }: Props) {
    const id = useId();
    const [visible, setVisible] = useState(false);

    return <div className={className}>
        <label htmlFor={id}>{label}</label>
        <div className="password-input">
            <input {...input} id={id} type={visible ? 'text' : 'password'} autoCapitalize="none" spellCheck={false}/>
            <button type="button" className="password-toggle" aria-controls={id}
                aria-label={(visible ? '隱藏' : '顯示') + label} onClick={() => setVisible(value => !value)}>
                {visible ? <EyeOff size={18} aria-hidden/> : <Eye size={18} aria-hidden/>}
            </button>
        </div>
    </div>;
}
