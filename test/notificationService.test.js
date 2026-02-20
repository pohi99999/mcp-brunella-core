import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendCriticalTasksEmail } from "../src/utils/notificationService.js";
const sendMailMock = vi.fn();
const createTransportMock = vi.fn();
vi.mock("nodemailer", () => ({
    default: {
        createTransport: (...args) => createTransportMock(...args),
    },
}));
describe("NotificationService", () => {
    const prevEnv = { ...process.env };
    beforeEach(() => {
        sendMailMock.mockResolvedValue({ messageId: "test" });
        createTransportMock.mockReturnValue({
            sendMail: sendMailMock,
        });
    });
    afterEach(() => {
        process.env = { ...prevEnv };
        vi.clearAllMocks();
    });
    it("returns false when SMTP config missing", async () => {
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_PORT;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
        delete process.env.SMTP_FROM;
        delete process.env.SMTP_TO;
        const result = await sendCriticalTasksEmail({
            count: 2,
            tasks: [
                { id: "1", todo_text: "Critical", file_path: "src/a.ts", line_number: 1 },
            ],
        });
        expect(result.sent).toBe(false);
        expect(createTransportMock).not.toHaveBeenCalled();
    });
    it("sends email when SMTP config present", async () => {
        process.env.SMTP_HOST = "smtp.test";
        process.env.SMTP_PORT = "587";
        process.env.SMTP_USER = "user";
        process.env.SMTP_PASS = "pass";
        process.env.SMTP_FROM = "from@test.dev";
        process.env.SMTP_TO = "to@test.dev";
        const result = await sendCriticalTasksEmail({
            count: 1,
            tasks: [
                { id: "1", todo_text: "Critical", file_path: "src/a.ts", line_number: 1 },
            ],
        });
        expect(result.sent).toBe(true);
        expect(createTransportMock).toHaveBeenCalled();
        expect(sendMailMock).toHaveBeenCalled();
    });
});
