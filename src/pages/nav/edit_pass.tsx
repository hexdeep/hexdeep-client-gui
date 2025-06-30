
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";

@Dialog
export class EditPassDialog extends CommonDialog<void> {
    // private api = new AuthService();
    private form = {
        oldPass: "",
        newPassword: "",
        confirmPassword: "",
    };

    public override show(): Promise<void> {
        this.title = "编辑设备";
        return super.show();
    }

    @ErrorProxy({ success: "密码修改成功", validatForm: "formRef" })
    protected override async onConfirm() {
        // await this.api.changePassword(this.form);
        this.close();
    }

    private get formRules() {
        return {
            oldPass: [
                { required: true, message: '必填项', trigger: 'blur' },
                { min: 4, max: 50, message: '长度4-50位', trigger: 'blur' },
            ],
            newPassword: [
                { required: true, message: '必填项', trigger: 'blur' },
                { min: 4, max: 50, message: '长度4-50位', trigger: 'blur' },
            ],
            confirmPassword: [
                { required: true, message: '必填项', trigger: 'blur' },
                { min: 4, max: 50, message: '长度4-50位', trigger: 'blur' },
                {
                    validator: (rule: any, value: any, callback: any) => {
                        if (value !== this.form.newPassword) {
                            callback(new Error('两次密码不一致'));
                        } else {
                            callback();
                        }
                    }
                }
            ]
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.form }} rules={this.formRules}>
                <el-form-item label="原密码" prop="oldPass">
                    <el-input type="password" v-model={this.form.oldPass} maxlength={50} />
                </el-form-item>
                <el-form-item label="新密码" prop="newPassword">
                    <el-input type="password" v-model={this.form.newPassword} maxlength={50} />
                </el-form-item>
                <el-form-item label="确认密码" prop="confirmPassword">
                    <el-input type="password" v-model={this.form.confirmPassword} maxlength={50} />
                </el-form-item>
            </el-form>
        );
    }
}