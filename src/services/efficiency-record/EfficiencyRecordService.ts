import { inject, singleton } from "tsyringe";
import * as XLSX from 'xlsx';

import { CreateEfficiencyRecordRequestDTO, CreateEfficiencyRecordResponseDTO, IEfficiencyRecordService } from "./IEfficiencyRecordService";
import type { IEfficiencyRecordRepository } from "@/repositories/efficiency-record/IEfficiencyRecordRepository";
import type { IProductionProcessRepository } from "@/repositories/production-process/IProductionProcessRepository";
import { classificationTypesMap, ClassificationTypes } from "@/entities/EfficiencyLoss";
import { EfficiencyRecord } from "@/entities/EfficiencyRecord";

@singleton()
export class EfficiencyRecordService implements IEfficiencyRecordService {

  constructor(
    @inject('ProductionProcessRepository') private readonly productionProcessRepository: IProductionProcessRepository,
    @inject('EfficiencyRecordRepository') private readonly efficiencyRecordRepository: IEfficiencyRecordRepository
  ) { }

  async createRecord(efficiencyRecordData: CreateEfficiencyRecordRequestDTO): Promise<CreateEfficiencyRecordResponseDTO> {
    const productionProcess = await this.productionProcessRepository.getById(efficiencyRecordData.process)
    if (!productionProcess) { throw new Error('Process not found') };

    let productionTimeInMinutes = 60

    if (efficiencyRecordData.hourInterval === '15:00-15:48') productionTimeInMinutes = 48
    if (efficiencyRecordData.hourInterval === '15:49-15:59') productionTimeInMinutes = 10

    const oeeValue = this.calculateOEE({
      cavitiesNumber: productionProcess.cavitiesNumber,
      cycleTimeInSeconds: productionProcess.cycleTimeInSeconds,
      piecesQuantity: efficiencyRecordData.piecesQuantity,
      productionTimeInMinutes: productionTimeInMinutes
    })

    const cycleTimeInMinutes = productionProcess.cycleTimeInSeconds / 60

    const productionEfficiencyLosses: EfficiencyRecord['productionEfficiencyLosses'] = efficiencyRecordData.reasons
      .map(item => {
        let lostTimeInMinutes = item.time
        if (item.class === 'Retrabalho' || item.class === 'Refugo') {
          lostTimeInMinutes = lostTimeInMinutes * cycleTimeInMinutes
        }
        return {
          classification: classificationTypesMap[item.class as ClassificationTypes],
          description: item.description,
          cause: item.class,
          lostTimeInMinutes
        }
      })

    const totalRework = efficiencyRecordData.reasons
      .filter(item => item.class === 'Retrabalho')
      .map(({ time: parts }) => parts)
      .reduce((acc, val) => acc + val, 0)

    const totalScrap = efficiencyRecordData.reasons
      .filter(item => item.class === 'Refugo')
      .map(({ time: parts }) => parts)
      .reduce((acc, val) => acc + val, 0)

    const totalReasonsTime = efficiencyRecordData.reasons
      .filter(item => item.class !== 'Retrabalho' && item.class !== 'Refugo')
      .map(({ time }) => time)
      .reduce((acc, val) => acc + val, 0)
      + totalRework
      + totalScrap

    const usefulTimeInMunites = oeeValue * productionTimeInMinutes
    const totalTimeOfMicroLosses = productionTimeInMinutes - totalReasonsTime - usefulTimeInMunites

    console.log(totalTimeOfMicroLosses)

    if (totalTimeOfMicroLosses > 0) {
      productionEfficiencyLosses.push({
        cause: 'Micro paradas',
        classification: 'Organizational Issues',
        description: '',
        lostTimeInMinutes: totalTimeOfMicroLosses
      })
    }

    const productionEfficiencyRecord: EfficiencyRecord = {
      date: new Date(efficiencyRecordData.date),
      oeeValue,
      productionEfficiencyLosses,
      piecesQuantity: efficiencyRecordData.piecesQuantity,
      productionProcessId: productionProcess.id,
      productionTimeInMinutes: productionTimeInMinutes,
      turn: efficiencyRecordData.turn,
      ute: efficiencyRecordData.ute as EfficiencyRecord['ute'],
      hourInterval: efficiencyRecordData.hourInterval
    }

    await this.efficiencyRecordRepository.create(productionEfficiencyRecord)

    return {
      oee: oeeValue,
      piecesQuantity: efficiencyRecordData.piecesQuantity,
      processName: productionProcess.description,
      totalReasonsTime,
      totalRework: totalRework / cycleTimeInMinutes,
      totalScrap: totalScrap / cycleTimeInMinutes,
      ute: efficiencyRecordData.ute
    }
  }

  private calculateOEE({ cycleTimeInSeconds, piecesQuantity, productionTimeInMinutes, cavitiesNumber }: {
    piecesQuantity: number
    cycleTimeInSeconds: number
    productionTimeInMinutes: number
    cavitiesNumber: number
  }) {
    const cycleTimeInMinutes = cycleTimeInSeconds / 60
    return (piecesQuantity * (cycleTimeInMinutes / cavitiesNumber)) / productionTimeInMinutes
  }

  async exportToExcel(): Promise<void> {
    const counts = (await this.efficiencyRecordRepository.getAll())
      .map(count => {
        return {
          'Data': count.date.toLocaleDateString(),
          'Turno': count.turn,
          'UTE': count.ute,
          'Hora': count.hourInterval,
          'Processo': count.productionProcessId,
          'Peças Boas': count.piecesQuantity,
          'OEE-hora': count.oeeValue,
        }
      })
    const worksheet = XLSX.utils.json_to_sheet(counts);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
    const fileName = `Relatório de produção.xlsx`
    XLSX.writeFile(workbook, fileName);
  }

}
