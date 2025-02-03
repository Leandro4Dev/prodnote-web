import { Button } from '../../components/Button';
import { FormProvider} from 'react-hook-form';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Reasons } from '../../components/Reasons';
import { HomeController } from './home.controller';

export type SuccessData = {
  processName: string
  piecesQuantity: number
  totalReasonsTime: number
  totalScrap: number
  totalRework: number
  oee: number
  ute: string
}

type props = {
  controller: HomeController
}

export function HomeView({ controller }: props) {

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 bg-white shadow-lg rounded-md max-md:h-full" >
      <h2 className='text-3xl font-bold mb-8' >Lançamento de OEE</h2>

      <FormProvider {...controller.form} >
        <form
          onKeyDown={e => {if (e.key === "Enter") e.preventDefault()} }
          onSubmit={controller.form.handleSubmit(controller.handleSave)}
          className='flex w-full flex-col gap-4'
        >
          <Select name='turn' label='Turno' options={['1', '2', '3'].map(val => ({value: val, label: val}))} />
          <Select name='hourInterval' label='Hora' options={controller.intervals.value.map(val => ({value: val, label: val}))} />

          <Select name='process' label='Processo de produção' loading={!controller.processLoad.value} options={
            controller.processes.value.map(val => ({value: val.id ?? '', label: val.description }))
          } />

          <Input type='number' name='piecesQuantity' label='Quantidade de Peças Boas:' />

          <div className="flex flex-col gap-2">
            <label className="mb-1 font-medium">Perdas de Eficiência:</label>
            {controller.reasonsField.fields.map((field, index) => (
              <Reasons key={field.id} index={index} onRemove={() => controller.removeReason(index)} />
            ))}
            <Button
              color='blue' type='button' text='Adicionar Perda'
              onClick={() => controller.addNewReason()}
            />
          </div>

          <Button loading={controller.loading.value} color='green' type='submit' text='Save' />

        </form>
      </FormProvider>
    </div>
  );
}
