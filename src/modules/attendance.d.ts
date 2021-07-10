export interface AttendancePoll {
	id: string; // identifier used to keep track of embed on pinned messages
	type: AttendanceType;
	title: string;
}

export interface ScheduledAttendancePoll extends AttendancePoll {
	type: "scheduled";
	cron: string; // cron schedule
	channelId: string; // channel to post the poll
}

export type AttendanceType = "single" | "scheduled";
