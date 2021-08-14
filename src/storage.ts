import { AttendancePoll } from "./modules/attendance.d";
import { promises as fs } from "fs";
import * as path from "path";
import { Storage } from "./storage.d";

const dataFolder = path.resolve("./data");
const attendanceFile = path.join(dataFolder, "attendance.json");

const storage: Storage = {
	attendance: [],
};

export const loadStorage = async (): Promise<void> => {
	try {
		storage.attendance = JSON.parse(
			await fs.readFile(attendanceFile, "utf-8")
		);
	} catch (e) {
		console.log(
			`Couldn't load attendance.json from data folder, ignoring it.`
		);
	}
};

export const getAttendancePolls = (): AttendancePoll[] => storage.attendance;
