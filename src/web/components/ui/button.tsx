import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-bold uppercase tracking-wide ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-2',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground border-primary hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-primary active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        destructive:
          'bg-destructive text-destructive-foreground border-destructive hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_0_hsl(var(--destructive))] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        outline:
          'border-foreground bg-background text-foreground hover:bg-foreground hover:text-background',
        secondary:
          'bg-secondary text-secondary-foreground border-border hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        ghost:
          'border-transparent hover:bg-accent hover:text-accent-foreground hover:border-border',
        link: 'text-primary underline-offset-4 hover:underline border-transparent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-12 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
