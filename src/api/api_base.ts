import { Config } from "@/common/Config";
import urlJoin from "url-join";

export class ApiBase {
    protected async handleError(res: Response) {
        const text = await res.text();
        var json: any;
        try {
            json = JSON.parse(text);
            if (json.code !== 200) {
                throw new Error(json.err ?? text ?? "unknown error");
            }
            return json.data;
        } catch (e: any) {
            throw new Error(e.message ?? text ?? "unknown error");
        }
    }


}