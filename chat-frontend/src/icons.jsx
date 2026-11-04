import { Icon } from "@chakra-ui/react";

const make = (path) =>
  function SvgIcon(props) {
    return (
      <Icon boxSize="5" {...props}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {path}
        </svg>
      </Icon>
    );
  };

export const LoginIcon = make(
  <>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="m10 17 5-5-5-5" />
    <path d="M15 12H3" />
  </>
);
export const SendIcon = make(
  <>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </>
);
export const ClockIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>
);
export const PlusIcon = make(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
);
export const HashIcon = make(
  <>
    <path d="M4 9h16" />
    <path d="M4 15h16" />
    <path d="M10 3 8 21" />
    <path d="m16 3-2 18" />
  </>
);
export const LockIcon = make(
  <>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </>
);
export const BackIcon = make(<path d="m15 18-6-6 6-6" />);
export const AttachmentIcon = make(<path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5L13 2.5a4 4 0 0 1 5.7 5.7l-8.5 8.5a2 2 0 0 1-2.8-2.8L15 6.3" />);
export const ReplyIcon = make(<><path d="m9 10-5 4 5 4" /><path d="M4 14h10a6 6 0 0 1 6 6V5" /></>);
export const CalendarIcon = make(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </>
);
