import { i18n } from "@/i18n/i18n";
import { ElForm } from "element-ui/types/form";
import Vue from "vue";

type LikeString = IString | string;

interface IString {
    toString(): string;
}

// MethodDecorator
// intercept error and show alert
export function ErrorProxy<T extends Vue>(options?: {
    confirm?: LikeString | ((self: T) => LikeString);
    loading?: LikeString;
    success?: LikeString;
    error?: LikeString;
    validatForm?: string | ((self: T) => any);
}
) {
    return (vm: T, _1: any, propertyDescriptor: PropertyDescriptor) => {
        let originMethod = propertyDescriptor.value;
        propertyDescriptor.value = async function (...args: any) {
            const self = this as T;
            if (options?.confirm) {
                const ret = await self.$confirm(
                    typeof options.confirm === "function" ? (options.confirm as any)(self) : options.confirm.toString(),
                    i18n.t("confirm.title") as string,
                    {
                        confirmButtonText: i18n.t("confirm.ok") as string,
                        cancelButtonText: i18n.t("confirm.cancel") as string,
                        type: "warning",
                    }
                ).catch(() => "cancel");
                if (ret != "confirm") return;
            }
            if (options?.validatForm) {
                const form = typeof options.validatForm === "function" ? options.validatForm(self) : self.$refs[options.validatForm] as ElForm;
                if (form) {
                    const result = await form.validate().catch(() => false);
                    if (!result) return;
                } else {
                    self.$alert(`表单[${options.validatForm}]不存在！`, i18n.t("error") as string, { type: "error" });
                    return;
                }
            }
            const l = options?.loading ? self.$loading({ text: options.loading.toString(), lock: true }) : null;
            try {
                const result = originMethod.call(self, ...args);
                if (result instanceof Promise) {
                    await result;
                }
                if (options?.success) {
                    self.$message.success({ message: options.success.toString(), center: false });
                }
            } catch (error) {
                let message = error instanceof Error ? error.message : `${error}`;
                self.$alert(message, options?.error?.toString() || i18n.t("error") as string, { type: "error" });
            } finally {
                l?.close();
            }
        };
    };
}